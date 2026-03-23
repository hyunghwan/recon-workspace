import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

import {
  beginGoogleSignIn,
  consumePostAuthAppAction,
  describeAuthError,
  signOutCurrentUser,
} from '@/auth'
import { useAuthSession } from '@/auth/auth-session'
import { createBlankWorkspaceBundle, createSampleSnapshot } from '@/data'
import { isFirebaseConfigured } from '@/firebase'
import {
  deleteImportFile,
  deletePeriodBundle,
  deleteRecordAnnotation,
  deleteWorkspaceBundle,
  loadReconSnapshot,
  replaceManualOverrides,
  savePeriodBundle,
  savePeriodRecord,
  saveReconSnapshot,
  saveRecordAnnotation,
  saveWorkspaceBundle,
  saveWorkspaceRecord,
  uploadImportFile,
} from '@/firestore'
import { saveSnapshot } from '@/storage'
import type {
  ImportFormState,
  ManualMatchOverride,
  PeriodBundle,
  ReconSnapshot,
  ReviewState,
  WorkspaceBundle,
  WorkspaceRecord,
} from '@/types'
import {
  buildEffectivePeriodBundle,
  buildFollowUpSummary,
  createEmptyPeriod,
  formatMonthLabel,
  parseImportFile,
  rebuildPeriodBundle,
  sourceTypeLabel,
} from '@/utils'
import { WorkspaceContext, type WorkspaceContextValue } from './workspace-context'
import type { AppPage } from './workspace-utils'
import {
  addWorkspaceBundle,
  buildAppPath,
  buildPeriodSelectionMap,
  downloadTextFile,
  replacePeriodBundle,
  resolveAppPage,
} from './workspace-utils'

function defaultSnapshot() {
  return createSampleSnapshot()
}

function replaceWorkspaceBundle(snapshot: ReconSnapshot, workspaceId: string, nextWorkspaceBundle: WorkspaceBundle) {
  return {
    workspaces: snapshot.workspaces.map((workspaceBundle) => {
      return workspaceBundle.workspace.id === workspaceId ? nextWorkspaceBundle : workspaceBundle
    }),
  }
}

function removeWorkspaceBundle(snapshot: ReconSnapshot, workspaceId: string) {
  return {
    workspaces: snapshot.workspaces.filter((workspaceBundle) => workspaceBundle.workspace.id !== workspaceId),
  }
}

function removePeriodBundle(snapshot: ReconSnapshot, workspaceId: string, periodId: string) {
  return {
    workspaces: snapshot.workspaces.map((workspaceBundle) => {
      if (workspaceBundle.workspace.id !== workspaceId) return workspaceBundle

      return {
        workspace: workspaceBundle.workspace,
        periods: workspaceBundle.periods.filter((periodBundle) => periodBundle.period.id !== periodId),
      }
    }),
  }
}

function updateWorkspaceRecord(workspaceBundle: WorkspaceBundle, workspace: WorkspaceRecord): WorkspaceBundle {
  return {
    workspace,
    periods: workspaceBundle.periods,
  }
}

function recordIdsIntersect(left: string[], rightSet: Set<string>) {
  return left.some((recordId) => rightSet.has(recordId))
}

function normalizeAnnotationInput(note: string, reviewState: ReviewState) {
  const normalizedNote = note.trim() || null

  if (!normalizedNote && reviewState === 'none') {
    return null
  }

  return {
    note: normalizedNote,
    reviewState,
  }
}

function applyAnnotationToPeriod(
  periodBundle: PeriodBundle,
  input: {
    note: string
    recordId: string
    reviewState: ReviewState
    updatedBy: string
  },
) {
  const normalized = normalizeAnnotationInput(input.note, input.reviewState)
  const now = new Date().toISOString()
  const nextAnnotations = periodBundle.annotations.filter((annotation) => annotation.recordId !== input.recordId)

  if (normalized) {
    nextAnnotations.push({
      recordId: input.recordId,
      note: normalized.note,
      reviewState: normalized.reviewState,
      updatedAt: now,
      updatedBy: input.updatedBy,
    })
  }

  return {
    ...periodBundle,
    period: {
      ...periodBundle.period,
      updatedAt: now,
    },
    annotations: nextAnnotations.sort((left, right) => left.recordId.localeCompare(right.recordId)),
  }
}

function applyManualOverrideToPeriod(
  periodBundle: PeriodBundle,
  input: {
    createdBy: string
    kind: ManualMatchOverride['kind']
    note?: string
    recordIds: string[]
  },
) {
  const uniqueRecordIds = Array.from(new Set(input.recordIds))
  const note = input.note?.trim() || null
  const now = new Date().toISOString()
  const recordIdSet = new Set(uniqueRecordIds)

  const nextOverrides = periodBundle.manualOverrides.filter((override) => {
    return !recordIdsIntersect(override.recordIds, recordIdSet)
  })

  nextOverrides.push({
    id: `override_${crypto.randomUUID()}`,
    periodId: periodBundle.period.id,
    kind: input.kind,
    recordIds: uniqueRecordIds,
    note,
    createdAt: now,
    updatedAt: now,
    createdBy: input.createdBy,
  })

  return {
    ...periodBundle,
    period: {
      ...periodBundle.period,
      updatedAt: now,
    },
    manualOverrides: nextOverrides.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
  }
}

function removeDeletedImportReferences(periodBundle: PeriodBundle, deletedRecordIds: string[]) {
  const deletedRecordIdSet = new Set(deletedRecordIds)

  const annotations = periodBundle.annotations.filter((annotation) => !deletedRecordIdSet.has(annotation.recordId))
  const manualOverrides = periodBundle.manualOverrides
    .map((override) => ({
      ...override,
      recordIds: override.recordIds.filter((recordId) => !deletedRecordIdSet.has(recordId)),
    }))
    .filter((override) => override.recordIds.length > 0)

  return {
    annotations,
    manualOverrides,
  }
}

function buildSnapshotDefaultPath(snapshot: ReconSnapshot, page: AppPage = 'queue') {
  const defaultWorkspace = snapshot.workspaces.find((workspaceBundle) => workspaceBundle.periods.length) ?? snapshot.workspaces[0]
  const defaultPeriod = defaultWorkspace?.periods[0]

  if (!defaultWorkspace || !defaultPeriod) {
    return null
  }

  return buildAppPath(defaultWorkspace.workspace.id, defaultPeriod.period.id, page)
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams()
  const { ready: authReady, user } = useAuthSession()

  const [snapshot, setSnapshot] = useState<ReconSnapshot>(() => defaultSnapshot())
  const [selectedPeriodIdByWorkspace, setSelectedPeriodIdByWorkspace] = useState(() =>
    buildPeriodSelectionMap(defaultSnapshot()),
  )
  const [cloudMessage, setCloudMessage] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [loadingCloud, setLoadingCloud] = useState(false)
  const [importing, setImporting] = useState(false)
  const [cloudHydrated, setCloudHydrated] = useState(false)
  const [showNewWorkspaceForm, setShowNewWorkspaceForm] = useState(false)
  const [showNewPeriodForm, setShowNewPeriodForm] = useState(false)
  const cloudEnabled = isFirebaseConfigured

  const currentPage = resolveAppPage(location.pathname)
  const workspaceIdParam = params.workspaceId
  const periodIdParam = params.periodId

  useEffect(() => {
    saveSnapshot(snapshot)
  }, [snapshot])

  useEffect(() => {
    if (!authReady) return

    if (!user || !cloudEnabled) {
      if (!user) {
        const sampleSnapshot = createSampleSnapshot()
        setSnapshot(sampleSnapshot)
        setSelectedPeriodIdByWorkspace(buildPeriodSelectionMap(sampleSnapshot))
      }
      setLoadingCloud(false)
      setCloudHydrated(true)
      return
    }

    const activeUser = user
    let cancelled = false

    async function hydrateCloudSnapshot() {
      try {
        setCloudHydrated(false)
        setLoadingCloud(true)
        const cloudSnapshot = await loadReconSnapshot(activeUser.uid)
        if (cancelled) return

        if (cloudSnapshot.workspaces.length) {
          setSnapshot(cloudSnapshot)
          setSelectedPeriodIdByWorkspace((current) => buildPeriodSelectionMap(cloudSnapshot, current))
          setCloudMessage(`Loaded ${cloudSnapshot.workspaces.length} client workspace${cloudSnapshot.workspaces.length > 1 ? 's' : ''} from Firebase.`)
        } else {
          setSnapshot(cloudSnapshot)
          setSelectedPeriodIdByWorkspace({})
          setCloudMessage('Signed in. Create a client workspace or import a CSV to start saving your work.')
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown cloud load error'
        setCloudMessage(`Cloud load error: ${message}`)
      } finally {
        if (!cancelled) {
          setLoadingCloud(false)
          setCloudHydrated(true)
        }
      }
    }

    void hydrateCloudSnapshot()

    return () => {
      cancelled = true
    }
  }, [authReady, cloudEnabled, user])

  useEffect(() => {
    setSelectedPeriodIdByWorkspace((current) => buildPeriodSelectionMap(snapshot, current))
  }, [snapshot])

  useEffect(() => {
    if (!workspaceIdParam || !periodIdParam) return

    setSelectedPeriodIdByWorkspace((current) => {
      if (current[workspaceIdParam] === periodIdParam) return current
      return {
        ...current,
        [workspaceIdParam]: periodIdParam,
      }
    })
  }, [periodIdParam, workspaceIdParam])

  const currentWorkspace = useMemo(() => {
    return snapshot.workspaces.find((workspaceBundle) => workspaceBundle.workspace.id === workspaceIdParam) ?? snapshot.workspaces[0] ?? null
  }, [snapshot.workspaces, workspaceIdParam])

  const currentWorkspaceId = currentWorkspace?.workspace.id ?? ''
  const selectedPeriodId =
    (currentWorkspace ? selectedPeriodIdByWorkspace[currentWorkspace.workspace.id] : '') ||
    currentWorkspace?.periods[0]?.period.id ||
    ''
  const requestedPeriodId = currentWorkspace && currentWorkspace.workspace.id === workspaceIdParam ? periodIdParam : ''
  const activePeriodId = requestedPeriodId || selectedPeriodId

  const currentRawPeriodBundle = useMemo(() => {
    if (!currentWorkspace) return null
    return currentWorkspace.periods.find((periodBundle) => periodBundle.period.id === activePeriodId) ?? currentWorkspace.periods[0] ?? null
  }, [activePeriodId, currentWorkspace])

  const currentPeriodBundle = useMemo(() => {
    return currentRawPeriodBundle ? buildEffectivePeriodBundle(currentRawPeriodBundle) : null
  }, [currentRawPeriodBundle])

  const currentPeriodId = currentPeriodBundle?.period.id ?? ''
  const stats = currentPeriodBundle?.period.matchCounts
  const followUpSummary = currentPeriodBundle
    ? buildFollowUpSummary(currentPeriodBundle, currentWorkspace?.workspace.defaultCurrency)
    : 'No month selected.'

  const routingReady = resolveRoutingReady({
    authReady,
    cloudEnabled,
    cloudHydrated,
    userSignedIn: Boolean(user),
  })

  const buildCurrentPath = useCallback((page: AppPage = currentPage) => {
    if (!currentWorkspaceId || !currentPeriodId) return null
    return buildAppPath(currentWorkspaceId, currentPeriodId, page)
  }, [currentPage, currentPeriodId, currentWorkspaceId])

  const buildDefaultPath = useCallback((page: AppPage = 'queue') => {
    return buildSnapshotDefaultPath(snapshot, page)
  }, [snapshot])

  useEffect(() => {
    if (!routingReady) return
    if (!workspaceIdParam || !periodIdParam) return
    if (workspaceIdParam === currentWorkspaceId && periodIdParam === currentPeriodId) return

    const nextPath = buildCurrentPath()
    if (!nextPath || nextPath === location.pathname) return
    navigate(nextPath, { replace: true })
  }, [
    buildCurrentPath,
    currentPeriodId,
    currentWorkspaceId,
    location.pathname,
    navigate,
    periodIdParam,
    routingReady,
    workspaceIdParam,
  ])

  useEffect(() => {
    if (!user || !routingReady) return

    const appAction = consumePostAuthAppAction()
    if (appAction !== 'show_import') return

    const importPath = buildCurrentPath('imports') ?? buildDefaultPath('imports')
    const currentPath = `${location.pathname}${location.search}${location.hash}`

    setCloudMessage('Signed in. Choose a file type and upload your CSV.')

    if (importPath && currentPath !== importPath) {
      navigate(importPath, { replace: true })
    }
  }, [
    buildCurrentPath,
    buildDefaultPath,
    location.hash,
    location.pathname,
    location.search,
    navigate,
    routingReady,
    user,
  ])

  function applySnapshot(nextSnapshot: ReconSnapshot) {
    setSnapshot(nextSnapshot)
    setSelectedPeriodIdByWorkspace((current) => buildPeriodSelectionMap(nextSnapshot, current))
  }

  async function persistCloudTask(task: () => Promise<void>, successMessage: string) {
    if (!user || !cloudEnabled) {
      setCloudMessage(successMessage)
      return
    }

    try {
      setSyncing(true)
      await task()
      setCloudMessage(`${successMessage} Synced to Firebase.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown cloud save error'
      setCloudMessage(`Cloud save error: ${message}`)
    } finally {
      setSyncing(false)
    }
  }

  function commitSnapshot(nextSnapshot: ReconSnapshot, successMessage: string, task?: () => Promise<void>) {
    applySnapshot(nextSnapshot)
    setCloudMessage(successMessage)
    if (task) {
      void persistCloudTask(task, successMessage)
    }
  }

  function navigateToWorkspace(workspaceId: string) {
    const workspaceBundle = snapshot.workspaces.find((bundle) => bundle.workspace.id === workspaceId)
    const nextPeriodId =
      selectedPeriodIdByWorkspace[workspaceId] ||
      workspaceBundle?.periods[0]?.period.id ||
      ''

    if (!workspaceBundle || !nextPeriodId) return
    navigate(buildAppPath(workspaceId, nextPeriodId, currentPage))
  }

  function navigateToPeriod(periodId: string) {
    if (!currentWorkspaceId) return

    setSelectedPeriodIdByWorkspace((current) => ({
      ...current,
      [currentWorkspaceId]: periodId,
    }))
    navigate(buildAppPath(currentWorkspaceId, periodId, currentPage))
  }

  function handleCreateWorkspace(name: string) {
    const trimmedName = name.trim()
    const ownerUserId = user?.uid ?? 'demo-user'
    const nextBundle = createBlankWorkspaceBundle(trimmedName || 'New workspace', ownerUserId)
    const nextSnapshot = addWorkspaceBundle(snapshot, nextBundle)
    const nextPeriodId = nextBundle.periods[0]?.period.id ?? ''

    setSelectedPeriodIdByWorkspace((current) => ({
      ...buildPeriodSelectionMap(nextSnapshot, current),
      [nextBundle.workspace.id]: nextPeriodId,
    }))
    setShowNewWorkspaceForm(false)
    commitSnapshot(
      nextSnapshot,
      `Created client workspace ${nextBundle.workspace.name}.`,
      user && cloudEnabled ? () => saveWorkspaceBundle(user.uid, nextBundle) : undefined,
    )

    if (nextPeriodId) {
      navigate(buildAppPath(nextBundle.workspace.id, nextPeriodId, currentPage))
    }
  }

  async function handleRenameWorkspace(name: string) {
    if (!currentWorkspace) return

    const trimmedName = name.trim()
    if (!trimmedName) {
      setCloudMessage('Enter a workspace name before saving.')
      return
    }

    const nextWorkspaceRecord: WorkspaceRecord = {
      ...currentWorkspace.workspace,
      name: trimmedName,
      updatedAt: new Date().toISOString(),
    }
    const nextSnapshot = replaceWorkspaceBundle(
      snapshot,
      currentWorkspace.workspace.id,
      updateWorkspaceRecord(currentWorkspace, nextWorkspaceRecord),
    )

    commitSnapshot(
      nextSnapshot,
      `Renamed workspace to ${trimmedName}.`,
      user && cloudEnabled ? () => saveWorkspaceRecord(user.uid, nextWorkspaceRecord) : undefined,
    )
  }

  async function handleDeleteWorkspace() {
    if (!currentWorkspace) return

    const nextSnapshot = removeWorkspaceBundle(snapshot, currentWorkspace.workspace.id)
    const nextPath = buildSnapshotDefaultPath(nextSnapshot, currentPage) ?? '/app'

    commitSnapshot(
      nextSnapshot,
      `Deleted workspace ${currentWorkspace.workspace.name}.`,
      user && cloudEnabled ? () => deleteWorkspaceBundle(user.uid, currentWorkspace.workspace.id) : undefined,
    )
    navigate(nextPath, { replace: true })
  }

  function handleCreatePeriod(monthKey: string) {
    if (!currentWorkspace) return

    const existing = currentWorkspace.periods.find((periodBundle) => periodBundle.period.monthKey === monthKey)
    if (existing) {
      setSelectedPeriodIdByWorkspace((current) => ({
        ...current,
        [currentWorkspace.workspace.id]: existing.period.id,
      }))
      setShowNewPeriodForm(false)
      setCloudMessage(`${formatMonthLabel(monthKey)} already exists for this workspace.`)
      navigate(buildAppPath(currentWorkspace.workspace.id, existing.period.id, currentPage))
      return
    }

    const nextPeriod = createEmptyPeriod(currentWorkspace.workspace.id, monthKey)
    const nextWorkspaceBundle: WorkspaceBundle = {
      workspace: {
        ...currentWorkspace.workspace,
        updatedAt: nextPeriod.period.updatedAt,
      },
      periods: [...currentWorkspace.periods, nextPeriod].sort((left, right) => right.period.monthKey.localeCompare(left.period.monthKey)),
    }
    const nextSnapshot = replaceWorkspaceBundle(snapshot, currentWorkspace.workspace.id, nextWorkspaceBundle)

    setSelectedPeriodIdByWorkspace((current) => ({
      ...current,
      [currentWorkspace.workspace.id]: nextPeriod.period.id,
    }))
    setShowNewPeriodForm(false)
    commitSnapshot(
      nextSnapshot,
      `Created ${formatMonthLabel(monthKey)}.`,
      user && cloudEnabled ? () => savePeriodBundle(user.uid, currentWorkspace.workspace.id, nextPeriod) : undefined,
    )
    navigate(buildAppPath(currentWorkspace.workspace.id, nextPeriod.period.id, currentPage))
  }

  async function handleDeletePeriod() {
    if (!currentWorkspace || !currentRawPeriodBundle) return

    const nextSnapshot = removePeriodBundle(snapshot, currentWorkspace.workspace.id, currentRawPeriodBundle.period.id)
    const nextPath = buildSnapshotDefaultPath(nextSnapshot, currentPage) ?? '/app'

    commitSnapshot(
      nextSnapshot,
      `Deleted ${formatMonthLabel(currentRawPeriodBundle.period.monthKey)}.`,
      user && cloudEnabled ? () => deletePeriodBundle(user.uid, currentWorkspace.workspace.id, currentRawPeriodBundle.period.id) : undefined,
    )
    navigate(nextPath, { replace: true })
  }

  async function handleImportBatch(input: { file: File | null; form: ImportFormState }) {
    if (!currentWorkspace || !currentRawPeriodBundle || !input.file) {
      setCloudMessage('Choose a file, client, and month before importing.')
      return
    }

    if (!cloudEnabled || !user) {
      setCloudMessage('Sign in with Google to upload original CSV files into Firebase Storage.')
      return
    }

    try {
      setImporting(true)
      const text = await input.file.text()
      const parsedImport = await parseImportFile({
        text,
        fileName: input.file.name,
        workspaceId: currentWorkspace.workspace.id,
        periodId: currentRawPeriodBundle.period.id,
        monthKey: currentRawPeriodBundle.period.monthKey,
        sourceType: input.form.sourceType,
        projectKey: input.form.projectKey,
        accountKey: input.form.accountKey,
        defaultCurrency: currentWorkspace.workspace.defaultCurrency,
        existingImports: currentRawPeriodBundle.imports,
      })

      if (parsedImport.duplicateOfImportId) {
        setCloudMessage(`Duplicate skipped. This file matches import ${parsedImport.duplicateOfImportId}.`)
        return
      }

      const uploaded = await uploadImportFile(
        user.uid,
        currentWorkspace.workspace.id,
        currentRawPeriodBundle.period.id,
        parsedImport.batch.id,
        input.file,
      )

      const nextBatch = {
        ...parsedImport.batch,
        storagePath: uploaded.storagePath,
      }
      const nextPeriodBundle = rebuildPeriodBundle(
        currentRawPeriodBundle.period,
        [nextBatch, ...currentRawPeriodBundle.imports],
        [...currentRawPeriodBundle.records, ...parsedImport.records],
        {
          annotations: currentRawPeriodBundle.annotations,
          manualOverrides: currentRawPeriodBundle.manualOverrides,
        },
      )
      const nextSnapshot = replacePeriodBundle(snapshot, currentWorkspace.workspace.id, nextPeriodBundle)

      setSelectedPeriodIdByWorkspace((current) => ({
        ...current,
        [currentWorkspace.workspace.id]: nextPeriodBundle.period.id,
      }))

      commitSnapshot(
        nextSnapshot,
        `Imported ${parsedImport.records.length} ${sourceTypeLabel(input.form.sourceType).toLowerCase()} records from ${input.file.name}.`,
        () => savePeriodBundle(user.uid, currentWorkspace.workspace.id, nextPeriodBundle),
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown import error'
      setCloudMessage(`Import error: ${message}`)
    } finally {
      setImporting(false)
    }
  }

  async function handleDeleteImportBatch(importId: string) {
    if (!currentWorkspace || !currentRawPeriodBundle) return

    const importBatch = currentRawPeriodBundle.imports.find((item) => item.id === importId)
    if (!importBatch) return

    const remainingImports = currentRawPeriodBundle.imports.filter((item) => item.id !== importId)
    const deletedRecords = currentRawPeriodBundle.records.filter((record) => record.importId === importId)
    const deletedRecordIds = deletedRecords.map((record) => record.id)
    const remainingRecords = currentRawPeriodBundle.records.filter((record) => record.importId !== importId)
    const cleanedReferences = removeDeletedImportReferences(currentRawPeriodBundle, deletedRecordIds)
    const nextPeriodBundle = rebuildPeriodBundle(
      currentRawPeriodBundle.period,
      remainingImports,
      remainingRecords,
      cleanedReferences,
    )
    const nextSnapshot = replacePeriodBundle(snapshot, currentWorkspace.workspace.id, nextPeriodBundle)

    commitSnapshot(
      nextSnapshot,
      `Deleted import ${importBatch.fileName}.`,
      user && cloudEnabled
        ? async () => {
            await savePeriodBundle(user.uid, currentWorkspace.workspace.id, nextPeriodBundle)
            await deleteImportFile(importBatch.storagePath)
          }
        : undefined,
    )
  }

  async function handleSaveRecordAnnotation(input: {
    note: string
    recordId: string
    reviewState: ReviewState
  }) {
    if (!currentWorkspace || !currentRawPeriodBundle) return

    const targetRecord = currentRawPeriodBundle.records.find((record) => record.id === input.recordId)
    if (!targetRecord) return

    const updatedBy = user?.uid ?? 'demo-user'
    const nextRawPeriodBundle = applyAnnotationToPeriod(currentRawPeriodBundle, {
      ...input,
      updatedBy,
    })
    const nextSnapshot = replacePeriodBundle(snapshot, currentWorkspace.workspace.id, nextRawPeriodBundle)
    const nextEffectivePeriod = buildEffectivePeriodBundle(nextRawPeriodBundle)
    const annotationPayload = normalizeAnnotationInput(input.note, input.reviewState)

    commitSnapshot(
      nextSnapshot,
      `Saved notes for ${targetRecord.descriptionRaw}.`,
      user && cloudEnabled
        ? async () => {
            if (annotationPayload) {
              const annotation = nextRawPeriodBundle.annotations.find((item) => item.recordId === input.recordId)
              if (annotation) {
                await saveRecordAnnotation(user.uid, currentWorkspace.workspace.id, currentRawPeriodBundle.period.id, annotation)
              }
            } else {
              await deleteRecordAnnotation(user.uid, currentWorkspace.workspace.id, currentRawPeriodBundle.period.id, input.recordId)
            }

            await savePeriodRecord(user.uid, currentWorkspace.workspace.id, nextEffectivePeriod.period)
          }
        : undefined,
    )
  }

  async function handleManualMatch(input: { note?: string; recordIds: string[] }) {
    if (!currentWorkspace || !currentRawPeriodBundle) return
    if (input.recordIds.length < 2) {
      setCloudMessage('Select at least two records before creating a manual match.')
      return
    }

    const nextRawPeriodBundle = applyManualOverrideToPeriod(currentRawPeriodBundle, {
      createdBy: user?.uid ?? 'demo-user',
      kind: 'manual_match',
      note: input.note,
      recordIds: input.recordIds,
    })
    const nextSnapshot = replacePeriodBundle(snapshot, currentWorkspace.workspace.id, nextRawPeriodBundle)
    const nextEffectivePeriod = buildEffectivePeriodBundle(nextRawPeriodBundle)

    commitSnapshot(
      nextSnapshot,
      `Created a manual match for ${input.recordIds.length} records.`,
      user && cloudEnabled
        ? async () => {
            await replaceManualOverrides(
              user.uid,
              currentWorkspace.workspace.id,
              currentRawPeriodBundle.period.id,
              nextRawPeriodBundle.manualOverrides,
            )
            await savePeriodRecord(user.uid, currentWorkspace.workspace.id, nextEffectivePeriod.period)
          }
        : undefined,
    )
  }

  async function handleManualUnmatch(input: { note?: string; recordIds: string[] }) {
    if (!currentWorkspace || !currentRawPeriodBundle) return
    if (!input.recordIds.length) return

    const nextRawPeriodBundle = applyManualOverrideToPeriod(currentRawPeriodBundle, {
      createdBy: user?.uid ?? 'demo-user',
      kind: 'manual_unmatch',
      note: input.note,
      recordIds: input.recordIds,
    })
    const nextSnapshot = replacePeriodBundle(snapshot, currentWorkspace.workspace.id, nextRawPeriodBundle)
    const nextEffectivePeriod = buildEffectivePeriodBundle(nextRawPeriodBundle)

    commitSnapshot(
      nextSnapshot,
      `Moved ${input.recordIds.length} records back into review.`,
      user && cloudEnabled
        ? async () => {
            await replaceManualOverrides(
              user.uid,
              currentWorkspace.workspace.id,
              currentRawPeriodBundle.period.id,
              nextRawPeriodBundle.manualOverrides,
            )
            await savePeriodRecord(user.uid, currentWorkspace.workspace.id, nextEffectivePeriod.period)
          }
        : undefined,
    )
  }

  async function handleManualSave() {
    if (!user) {
      setCloudMessage('Sign in first if you want to sync workspaces to Firebase.')
      return
    }

    await persistCloudTask(() => saveReconSnapshot(user.uid, snapshot), 'Snapshot synced.')
  }

  async function handleDirectSignIn() {
    if (!cloudEnabled) {
      setCloudMessage('Firebase is not configured yet. Sample workspaces still load locally.')
      return
    }

    try {
      setCloudMessage('Signing in with Google…')
      await beginGoogleSignIn({
        mode: 'default',
        returnTo: `${location.pathname}${location.search}${location.hash}`,
      })
    } catch (error) {
      setCloudMessage(`Login issue: ${describeAuthError(error)}`)
    }
  }

  async function handleImportSignIn() {
    if (!cloudEnabled) {
      setCloudMessage('Firebase is not configured yet. Sample workspaces still load locally.')
      return
    }

    try {
      setCloudMessage('Sign in to upload and store original CSV files.')
      await beginGoogleSignIn({
        mode: 'import',
        returnTo: buildCurrentPath('imports') ?? `${location.pathname}${location.search}${location.hash}`,
      })
    } catch (error) {
      setCloudMessage(`Login issue: ${describeAuthError(error)}`)
    }
  }

  async function handleSignOut() {
    await signOutCurrentUser()

    const sampleSnapshot = createSampleSnapshot()
    applySnapshot(sampleSnapshot)
    setShowNewPeriodForm(false)
    setShowNewWorkspaceForm(false)
    setCloudMessage('Signed out. Restored the sample workspace.')
    const nextPath = buildSnapshotDefaultPath(sampleSnapshot, 'queue')
    if (nextPath) {
      navigate(nextPath)
    }
  }

  function handleLoadSampleSnapshot() {
    const sampleSnapshot = createSampleSnapshot()
    applySnapshot(sampleSnapshot)
    setShowNewPeriodForm(false)
    setShowNewWorkspaceForm(false)
    setCloudMessage('Loaded the sample workspace.')
    const nextPath = buildSnapshotDefaultPath(sampleSnapshot, currentPage)
    if (nextPath) {
      navigate(nextPath)
    }
  }

  function handleExportFollowUp() {
    if (!currentPeriodBundle) return
    downloadTextFile(`follow-up-${currentPeriodBundle.period.monthKey}.txt`, followUpSummary)
  }

  const value: WorkspaceContextValue = {
    authReady,
    buildCurrentPath,
    buildDefaultPath,
    cloudEnabled,
    cloudMessage,
    currentPage,
    currentPeriodBundle,
    currentPeriodId,
    currentWorkspace,
    currentWorkspaceId,
    followUpSummary,
    handleCreatePeriod,
    handleCreateWorkspace,
    handleDeleteImportBatch,
    handleDeletePeriod,
    handleDeleteWorkspace,
    handleDirectSignIn,
    handleExportFollowUp,
    handleImportBatch,
    handleImportSignIn,
    handleLoadSampleSnapshot,
    handleManualMatch,
    handleManualSave,
    handleManualUnmatch,
    handleRenameWorkspace,
    handleSaveRecordAnnotation,
    handleSignOut,
    importing,
    loadingCloud,
    navigateToPeriod,
    navigateToWorkspace,
    routingReady,
    selectedPeriodIdByWorkspace,
    setCloudMessage,
    setShowNewPeriodForm,
    setShowNewWorkspaceForm,
    showNewPeriodForm,
    showNewWorkspaceForm,
    snapshot,
    stats,
    syncing,
    userEmail: user?.email ?? null,
    userSignedIn: Boolean(user),
  }

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

function resolveRoutingReady(input: {
  authReady: boolean
  cloudEnabled: boolean
  cloudHydrated: boolean
  userSignedIn: boolean
}) {
  if (!input.authReady) return false
  if (!input.userSignedIn || !input.cloudEnabled) return true
  return input.cloudHydrated
}
