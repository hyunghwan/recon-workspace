import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  writeBatch,
  type CollectionReference,
  type Firestore,
} from 'firebase/firestore'
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
  type FirebaseStorage,
} from 'firebase/storage'

import { firestore, firebaseStorage } from './firebase'
import type {
  ImportBatchRecord,
  ManualMatchOverride,
  MatchResultRecord,
  NormalizedRecord,
  PeriodBundle,
  PeriodRecord,
  ReconSnapshot,
  RecordAnnotation,
  WorkspaceBundle,
  WorkspaceRecord,
} from './types'

type FirestorePayload = Record<string, unknown>

function requireFirestore(): Firestore {
  if (!firestore) throw new Error('Firebase Firestore is not configured.')
  return firestore
}

function requireStorage(): FirebaseStorage {
  if (!firebaseStorage) throw new Error('Firebase Storage is not configured.')
  return firebaseStorage
}

function sanitizeForFirestore<T>(value: T): T {
  if (value === undefined) {
    return undefined as T
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeForFirestore(item))
      .filter((item) => item !== undefined) as T
  }

  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value as FirestorePayload)
        .map(([key, item]) => [key, sanitizeForFirestore(item)])
        .filter(([, item]) => item !== undefined),
    ) as T
  }

  return value
}

async function listDocIds(reference: CollectionReference) {
  const snapshot = await getDocs(reference)
  return snapshot.docs.map((docSnap) => docSnap.id)
}

async function setDocSanitized(reference: ReturnType<typeof doc>, payload: object) {
  await setDoc(reference, sanitizeForFirestore(payload))
}

async function replaceCollectionDocuments<T>(
  reference: CollectionReference,
  documents: T[],
  getId: (document: T) => string = (document) => (document as { id: string }).id,
) {
  const db = requireFirestore()
  const existingIds = new Set(await listDocIds(reference))
  const nextIds = new Set(documents.map((document) => getId(document)))
  const operations: Array<{ type: 'set' | 'delete'; id: string; payload?: T }> = []

  documents.forEach((item) => {
    operations.push({ type: 'set', id: getId(item), payload: item })
  })

  existingIds.forEach((existingId) => {
    if (!nextIds.has(existingId)) {
      operations.push({ type: 'delete', id: existingId })
    }
  })

  if (!operations.length) return

  let batch = writeBatch(db)
  let operationCount = 0

  const commitBatch = async () => {
    if (!operationCount) return
    await batch.commit()
    batch = writeBatch(db)
    operationCount = 0
  }

  for (const operation of operations) {
    const targetRef = doc(reference, operation.id)

    if (operation.type === 'set' && operation.payload) {
      batch.set(targetRef, sanitizeForFirestore(operation.payload))
    }

    if (operation.type === 'delete') {
      batch.delete(targetRef)
    }

    operationCount += 1

    if (operationCount >= 400) {
      await commitBatch()
    }
  }

  await commitBatch()
}

async function loadPeriodBundle(userId: string, workspaceId: string, period: PeriodRecord): Promise<PeriodBundle> {
  const db = requireFirestore()
  const periodRef = doc(db, 'users', userId, 'workspaces', workspaceId, 'periods', period.id)
  const [
    importsSnapshot,
    recordsSnapshot,
    matchesSnapshot,
    annotationsSnapshot,
    manualOverridesSnapshot,
  ] = await Promise.all([
    getDocs(collection(periodRef, 'imports')),
    getDocs(collection(periodRef, 'records')),
    getDocs(collection(periodRef, 'matches')),
    getDocs(collection(periodRef, 'annotations')),
    getDocs(collection(periodRef, 'manualOverrides')),
  ])

  return {
    period,
    imports: importsSnapshot.docs.map((docSnap) => docSnap.data() as ImportBatchRecord),
    records: recordsSnapshot.docs.map((docSnap) => ({
      ...(docSnap.data() as NormalizedRecord),
      note: (docSnap.data() as NormalizedRecord).note ?? null,
    })),
    matches: matchesSnapshot.docs.map((docSnap) => docSnap.data() as MatchResultRecord),
    annotations: annotationsSnapshot.docs.map((docSnap) => ({
      ...(docSnap.data() as RecordAnnotation),
      note: (docSnap.data() as RecordAnnotation).note ?? null,
    })),
    manualOverrides: manualOverridesSnapshot.docs.map((docSnap) => ({
      ...(docSnap.data() as ManualMatchOverride),
      note: (docSnap.data() as ManualMatchOverride).note ?? null,
    })),
  }
}

async function loadWorkspaceBundle(userId: string, workspace: WorkspaceRecord): Promise<WorkspaceBundle> {
  const db = requireFirestore()
  const periodsRef = collection(db, 'users', userId, 'workspaces', workspace.id, 'periods')
  const periodsSnapshot = await getDocs(periodsRef)
  const periods = periodsSnapshot.docs.map((docSnap) => docSnap.data() as PeriodRecord)
  const bundles = await Promise.all(
    periods.map((period) => loadPeriodBundle(userId, workspace.id, period)),
  )

  return {
    workspace,
    periods: bundles.sort((left, right) => right.period.monthKey.localeCompare(left.period.monthKey)),
  }
}

export async function loadReconSnapshot(userId: string): Promise<ReconSnapshot> {
  const db = requireFirestore()
  const workspacesRef = collection(db, 'users', userId, 'workspaces')
  const workspacesSnapshot = await getDocs(workspacesRef)
  const workspaces = workspacesSnapshot.docs.map((docSnap) => docSnap.data() as WorkspaceRecord)
  const bundles = await Promise.all(
    workspaces.map((workspace) => loadWorkspaceBundle(userId, workspace)),
  )

  return {
    workspaces: bundles.sort((left, right) => left.workspace.name.localeCompare(right.workspace.name)),
  }
}

async function deleteStorageAsset(storagePath: string) {
  if (!storagePath) return

  try {
    await deleteObject(ref(requireStorage(), storagePath))
  } catch (error) {
    const storageError = error as { code?: string } | undefined
    if (storageError?.code === 'storage/object-not-found') {
      return
    }

    throw error
  }
}

async function deleteImportAssets(userId: string, workspaceId: string, periodId: string) {
  const db = requireFirestore()
  const importsSnapshot = await getDocs(
    collection(db, 'users', userId, 'workspaces', workspaceId, 'periods', periodId, 'imports'),
  )

  await Promise.all(
    importsSnapshot.docs.map((docSnap) => {
      const item = docSnap.data() as ImportBatchRecord
      return deleteStorageAsset(item.storagePath)
    }),
  )
}

export async function deletePeriodBundle(userId: string, workspaceId: string, periodId: string) {
  const db = requireFirestore()
  const periodRef = doc(db, 'users', userId, 'workspaces', workspaceId, 'periods', periodId)

  await deleteImportAssets(userId, workspaceId, periodId)
  await replaceCollectionDocuments(collection(periodRef, 'imports'), [])
  await replaceCollectionDocuments(collection(periodRef, 'records'), [])
  await replaceCollectionDocuments(collection(periodRef, 'matches'), [])
  await replaceCollectionDocuments(collection(periodRef, 'annotations'), [])
  await replaceCollectionDocuments(collection(periodRef, 'manualOverrides'), [])
  await deleteDoc(periodRef)
}

export async function deleteWorkspaceBundle(userId: string, workspaceId: string) {
  const db = requireFirestore()
  const periodsRef = collection(db, 'users', userId, 'workspaces', workspaceId, 'periods')
  const periodIds = await listDocIds(periodsRef)

  for (const periodId of periodIds) {
    await deletePeriodBundle(userId, workspaceId, periodId)
  }

  await deleteDoc(doc(db, 'users', userId, 'workspaces', workspaceId))
}

async function syncPeriod(userId: string, workspaceId: string, periodBundle: PeriodBundle) {
  const db = requireFirestore()
  const periodRef = doc(db, 'users', userId, 'workspaces', workspaceId, 'periods', periodBundle.period.id)

  await setDocSanitized(periodRef, periodBundle.period)
  await replaceCollectionDocuments(collection(periodRef, 'imports'), periodBundle.imports)
  await replaceCollectionDocuments(collection(periodRef, 'records'), periodBundle.records)
  await replaceCollectionDocuments(collection(periodRef, 'matches'), periodBundle.matches)
  await replaceCollectionDocuments(collection(periodRef, 'annotations'), periodBundle.annotations, (annotation) => annotation.recordId)
  await replaceCollectionDocuments(collection(periodRef, 'manualOverrides'), periodBundle.manualOverrides)
}

async function syncWorkspace(userId: string, workspaceBundle: WorkspaceBundle) {
  const db = requireFirestore()
  const workspaceRef = doc(db, 'users', userId, 'workspaces', workspaceBundle.workspace.id)

  await setDocSanitized(workspaceRef, workspaceBundle.workspace)

  const periodsRef = collection(db, 'users', userId, 'workspaces', workspaceBundle.workspace.id, 'periods')
  const existingPeriodIds = new Set(await listDocIds(periodsRef))
  const nextPeriodIds = new Set(workspaceBundle.periods.map((periodBundle) => periodBundle.period.id))

  for (const periodBundle of workspaceBundle.periods) {
    await syncPeriod(userId, workspaceBundle.workspace.id, periodBundle)
  }

  for (const existingPeriodId of existingPeriodIds) {
    if (nextPeriodIds.has(existingPeriodId)) continue
    await deletePeriodBundle(userId, workspaceBundle.workspace.id, existingPeriodId)
  }
}

export async function saveReconSnapshot(userId: string, snapshot: ReconSnapshot) {
  const db = requireFirestore()
  const workspacesRef = collection(db, 'users', userId, 'workspaces')
  const existingWorkspaceIds = new Set(await listDocIds(workspacesRef))
  const nextWorkspaceIds = new Set(snapshot.workspaces.map((workspaceBundle) => workspaceBundle.workspace.id))

  await Promise.all(snapshot.workspaces.map((workspaceBundle) => syncWorkspace(userId, workspaceBundle)))

  for (const existingWorkspaceId of existingWorkspaceIds) {
    if (nextWorkspaceIds.has(existingWorkspaceId)) continue
    await deleteWorkspaceBundle(userId, existingWorkspaceId)
  }
}

export async function saveWorkspaceBundle(userId: string, workspaceBundle: WorkspaceBundle) {
  await syncWorkspace(userId, workspaceBundle)
}

export async function saveWorkspaceRecord(userId: string, workspace: WorkspaceRecord) {
  const db = requireFirestore()
  await setDocSanitized(doc(db, 'users', userId, 'workspaces', workspace.id), workspace)
}

export async function savePeriodBundle(userId: string, workspaceId: string, periodBundle: PeriodBundle) {
  await syncPeriod(userId, workspaceId, periodBundle)
}

export async function savePeriodRecord(userId: string, workspaceId: string, period: PeriodRecord) {
  const db = requireFirestore()
  await setDocSanitized(doc(db, 'users', userId, 'workspaces', workspaceId, 'periods', period.id), period)
}

export async function saveRecordAnnotation(
  userId: string,
  workspaceId: string,
  periodId: string,
  annotation: RecordAnnotation,
) {
  const db = requireFirestore()
  await setDocSanitized(
    doc(db, 'users', userId, 'workspaces', workspaceId, 'periods', periodId, 'annotations', annotation.recordId),
    annotation,
  )
}

export async function deleteRecordAnnotation(
  userId: string,
  workspaceId: string,
  periodId: string,
  recordId: string,
) {
  const db = requireFirestore()
  await deleteDoc(
    doc(db, 'users', userId, 'workspaces', workspaceId, 'periods', periodId, 'annotations', recordId),
  )
}

export async function replaceManualOverrides(
  userId: string,
  workspaceId: string,
  periodId: string,
  overrides: ManualMatchOverride[],
) {
  const db = requireFirestore()
  const periodRef = doc(db, 'users', userId, 'workspaces', workspaceId, 'periods', periodId)
  await replaceCollectionDocuments(collection(periodRef, 'manualOverrides'), overrides)
}

export async function deleteImportFile(storagePath: string) {
  await deleteStorageAsset(storagePath)
}

export async function uploadImportFile(
  userId: string,
  workspaceId: string,
  periodId: string,
  importId: string,
  file: File,
) {
  const storage = requireStorage()
  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-')
  const storagePath = `users/${userId}/workspaces/${workspaceId}/periods/${periodId}/imports/${importId}/${safeFileName}`
  const fileRef = ref(storage, storagePath)

  await uploadBytes(fileRef, file, {
    contentType: file.type || 'text/csv',
  })

  return {
    storagePath,
    downloadUrl: await getDownloadURL(fileRef),
  }
}
