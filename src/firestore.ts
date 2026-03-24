import {
  collection,
  deleteDoc,
  doc,
  getDoc,
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

import {
  firebaseStorage,
  firebaseStorageBucket,
  firestore,
  isAppCheckConfigured,
  isAppCheckDebugEnabled,
  isAppCheckSiteKeyConfigured,
} from './firebase'
import type {
  ImportBatchRecord,
  ManualMatchOverride,
  MatchResultRecord,
  NormalizedRecord,
  PeriodBundle,
  PeriodRecord,
  ReconSnapshot,
  RecordAnnotation,
  UserWorkspacePreferences,
  WorkspaceBundle,
  WorkspaceRecord,
} from './types'

type FirestorePayload = Record<string, unknown>

export type ImportUploadFailureReason =
  | 'app-check-required'
  | 'bucket-misconfigured'
  | 'network'
  | 'unauthenticated'
  | 'unauthorized'
  | 'unknown'

export type ImportUploadDiagnostics = {
  appCheckConfigured: boolean
  appCheckDebugEnabled: boolean
  appCheckSiteKeyConfigured: boolean
  bucket: string | null
  firebaseCode: string | null
  importId: string
  message: string
  periodId: string
  reason: ImportUploadFailureReason
  serverResponse: string | null
  stage: 'download-url' | 'upload'
  status: number | null
  storagePath: string
  userId: string
  workspaceId: string
}

type FirebaseStorageLikeError = Error & {
  code?: string
  serverResponse?: string
  status?: number
}

type ImportUploadContext = {
  importId: string
  periodId: string
  stage: 'download-url' | 'upload'
  storagePath: string
  userId: string
  workspaceId: string
}

export class ImportUploadError extends Error {
  readonly diagnostics: ImportUploadDiagnostics
  readonly reason: ImportUploadFailureReason

  constructor(message: string, reason: ImportUploadFailureReason, diagnostics: ImportUploadDiagnostics) {
    super(message)
    this.name = 'ImportUploadError'
    this.reason = reason
    this.diagnostics = diagnostics
  }
}

function requireFirestore(): Firestore {
  if (!firestore) throw new Error('Firebase Firestore is not configured.')
  return firestore
}

function requireStorage(): FirebaseStorage {
  if (!firebaseStorage) throw new Error('Firebase Storage is not configured.')
  return firebaseStorage
}

function trimToNull(value: unknown) {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized ? normalized : null
}

function resolveImportUploadFailureReason(error: FirebaseStorageLikeError): ImportUploadFailureReason {
  const code = trimToNull(error.code)?.toLowerCase()
  const message = trimToNull(error.message)?.toLowerCase() ?? ''
  const serverResponse = trimToNull(error.serverResponse)?.toLowerCase() ?? ''
  const combined = `${code ?? ''} ${message} ${serverResponse}`

  if (
    code === 'storage/unauthorized-app' ||
    combined.includes('firebase app check token is invalid') ||
    combined.includes('app check')
  ) {
    return 'app-check-required'
  }

  if (code === 'storage/unauthenticated') {
    return 'unauthenticated'
  }

  if (code === 'storage/unauthorized') {
    return 'unauthorized'
  }

  if (
    combined.includes('firebase storage is not configured') ||
    combined.includes('storagebucket') ||
    error.status === 404 ||
    (code === 'storage/unknown' && combined.includes('not found'))
  ) {
    return 'bucket-misconfigured'
  }

  if (
    code === 'storage/retry-limit-exceeded' ||
    error.status === 0 ||
    combined.includes('err_failed') ||
    combined.includes('network error') ||
    combined.includes('failed to fetch') ||
    combined.includes('network request failed')
  ) {
    return 'network'
  }

  return 'unknown'
}

function describeImportUploadFailure(
  reason: ImportUploadFailureReason,
  diagnostics: Omit<ImportUploadDiagnostics, 'reason'>,
) {
  switch (reason) {
    case 'unauthenticated':
      return 'Upload failed because your Firebase session is no longer authenticated. Sign out, sign back in, and try the import again.'
    case 'unauthorized':
      return 'Upload reached Firebase Storage but was denied by Storage rules. Confirm the signed-in account owns this workspace and redeploy `storage.rules` if needed.'
    case 'app-check-required':
      return diagnostics.appCheckSiteKeyConfigured
        ? 'Upload was rejected by Firebase App Check. Check the browser console for the App Check token status and confirm the deployed site key is allowed for this domain.'
        : 'Upload was rejected by Firebase App Check. Add `VITE_FIREBASE_APPCHECK_SITE_KEY`, and set `VITE_FIREBASE_APPCHECK_DEBUG=true` locally if Cloud Storage enforcement is enabled.'
    case 'bucket-misconfigured':
      return 'Upload could not reach the configured Firebase Storage bucket. Verify `VITE_FIREBASE_STORAGE_BUCKET` matches the live Firebase web app config and that the bucket exists.'
    case 'network':
      return 'Upload request never completed. Check browser extensions, privacy settings, VPN/proxy rules, or network filters that could block Firebase Storage.'
    default:
      return 'Firebase Storage upload failed. Check the browser console diagnostics for the Firebase error code and server response.'
  }
}

function normalizeImportUploadError(error: unknown, context: ImportUploadContext) {
  if (error instanceof ImportUploadError) {
    return error
  }

  const storageError: FirebaseStorageLikeError =
    error instanceof Error
      ? (error as FirebaseStorageLikeError)
      : (new Error('Unknown upload error') as FirebaseStorageLikeError)
  const reason = resolveImportUploadFailureReason(storageError)
  const diagnosticsBase = {
    appCheckConfigured: isAppCheckConfigured,
    appCheckDebugEnabled: isAppCheckDebugEnabled,
    appCheckSiteKeyConfigured: isAppCheckSiteKeyConfigured,
    bucket: firebaseStorageBucket,
    firebaseCode: trimToNull(storageError.code),
    importId: context.importId,
    message: trimToNull(storageError.message) ?? 'Unknown upload error',
    periodId: context.periodId,
    serverResponse: trimToNull(storageError.serverResponse),
    stage: context.stage,
    status: typeof storageError.status === 'number' ? storageError.status : null,
    storagePath: context.storagePath,
    userId: context.userId,
    workspaceId: context.workspaceId,
  } satisfies Omit<ImportUploadDiagnostics, 'reason'>

  return new ImportUploadError(
    describeImportUploadFailure(reason, diagnosticsBase),
    reason,
    {
      ...diagnosticsBase,
      reason,
    },
  )
}

export function isImportUploadError(error: unknown): error is ImportUploadError {
  return error instanceof ImportUploadError
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

async function setDocSanitizedMerged(reference: ReturnType<typeof doc>, payload: object) {
  await setDoc(reference, sanitizeForFirestore(payload), { merge: true })
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
  const workspaces = workspacesSnapshot.docs.map((docSnap) => {
    const workspace = docSnap.data() as WorkspaceRecord & { origin?: WorkspaceRecord['origin'] }

    return {
      ...workspace,
      origin: workspace.origin ?? 'user',
    } satisfies WorkspaceRecord
  })
  const bundles = await Promise.all(
    workspaces.map((workspace) => loadWorkspaceBundle(userId, workspace)),
  )

  return {
    workspaces: bundles.sort((left, right) => left.workspace.name.localeCompare(right.workspace.name)),
  }
}

export async function loadUserWorkspacePreferences(userId: string): Promise<UserWorkspacePreferences> {
  const db = requireFirestore()
  const userSnapshot = await getDoc(doc(db, 'users', userId))

  if (!userSnapshot.exists()) {
    return {}
  }

  const userData = userSnapshot.data() as UserWorkspacePreferences

  return {
    sampleDismissedAt: userData.sampleDismissedAt ?? null,
    sampleSeededAt: userData.sampleSeededAt ?? null,
  }
}

export async function saveUserWorkspacePreferences(userId: string, preferences: UserWorkspacePreferences) {
  const db = requireFirestore()
  await setDocSanitizedMerged(doc(db, 'users', userId), preferences)
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
  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-')
  const storagePath = `users/${userId}/workspaces/${workspaceId}/periods/${periodId}/imports/${importId}/${safeFileName}`
  const uploadContext = {
    importId,
    periodId,
    storagePath,
    userId,
    workspaceId,
  }

  try {
    const storage = requireStorage()
    const fileRef = ref(storage, storagePath)

    await uploadBytes(fileRef, file, {
      contentType: file.type || 'text/csv',
    })

    try {
      return {
        storagePath,
        downloadUrl: await getDownloadURL(fileRef),
      }
    } catch (error) {
      throw normalizeImportUploadError(error, {
        ...uploadContext,
        stage: 'download-url',
      })
    }
  } catch (error) {
    throw normalizeImportUploadError(error, {
      ...uploadContext,
      stage: 'upload',
    })
  }
}
