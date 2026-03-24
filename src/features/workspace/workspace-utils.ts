import type {
  ImportFormState,
  MatchProvenance,
  MatchResultRecord,
  NormalizedRecord,
  PeriodBundle,
  RecordAnnotation,
  ReconSnapshot,
  SourceType,
  WorkspaceBundle,
} from '@/types'
import { resolvePrimaryRecord, uniqueValues } from '@/utils'
import { getWorkspaceOrigin } from './workspace-onboarding'

export type AppPage = 'queue' | 'imports' | 'follow-up'

export type QueueRow = {
  id: string
  match: MatchResultRecord
  matchSource: MatchProvenance
  primaryRecord: NormalizedRecord | null
  primaryAnnotation: RecordAnnotation | null
  annotations: RecordAnnotation[]
  relatedRecords: NormalizedRecord[]
  importNames: string[]
  projectKeys: string[]
  accountKeys: string[]
  sourceTypes: SourceType[]
  searchText: string
}

export const defaultImportForm: ImportFormState = {
  sourceType: 'statement',
  projectKey: 'month-end',
  accountKey: 'operating-bank',
}

export function buildPeriodSelectionMap(snapshot: ReconSnapshot, previous: Record<string, string> = {}) {
  return Object.fromEntries(
    snapshot.workspaces.map((workspaceBundle) => {
      const existingPeriodId = previous[workspaceBundle.workspace.id]
      const fallbackPeriodId = workspaceBundle.periods[0]?.period.id ?? ''
      const hasExisting = workspaceBundle.periods.some((periodBundle) => periodBundle.period.id === existingPeriodId)
      return [workspaceBundle.workspace.id, hasExisting ? existingPeriodId : fallbackPeriodId]
    }),
  )
}

export function sortWorkspaces(workspaces: WorkspaceBundle[]) {
  return [...workspaces].sort((left, right) => {
    const originDelta = Number(getWorkspaceOrigin(left.workspace) === 'sample') - Number(getWorkspaceOrigin(right.workspace) === 'sample')
    if (originDelta !== 0) return originDelta
    return left.workspace.name.localeCompare(right.workspace.name)
  })
}

export function replacePeriodBundle(snapshot: ReconSnapshot, workspaceId: string, nextPeriodBundle: PeriodBundle) {
  return {
    workspaces: snapshot.workspaces.map((workspaceBundle) => {
      if (workspaceBundle.workspace.id !== workspaceId) return workspaceBundle

      const nextPeriods = [
        ...workspaceBundle.periods.filter((periodBundle) => periodBundle.period.id !== nextPeriodBundle.period.id),
        nextPeriodBundle,
      ].sort((left, right) => right.period.monthKey.localeCompare(left.period.monthKey))

      return {
        workspace: {
          ...workspaceBundle.workspace,
          updatedAt: nextPeriodBundle.period.updatedAt,
        },
        periods: nextPeriods,
      }
    }),
  }
}

export function addWorkspaceBundle(snapshot: ReconSnapshot, workspaceBundle: WorkspaceBundle) {
  return {
    workspaces: sortWorkspaces([...snapshot.workspaces, workspaceBundle]),
  }
}

export function buildQueueRows(periodBundle: PeriodBundle | null): QueueRow[] {
  if (!periodBundle) return []

  const recordMap = new Map(periodBundle.records.map((record) => [record.id, record]))
  const importMap = new Map(periodBundle.imports.map((item) => [item.id, item]))
  const annotationMap = new Map(periodBundle.annotations.map((annotation) => [annotation.recordId, annotation]))

  return periodBundle.matches.map((match) => {
    const relatedRecords = match.recordIds
      .map((recordId) => recordMap.get(recordId))
      .filter(Boolean) as NormalizedRecord[]
    const primaryRecord = resolvePrimaryRecord(match, periodBundle.records)
    const annotations = relatedRecords
      .map((record) => annotationMap.get(record.id))
      .filter(Boolean) as RecordAnnotation[]
    const primaryAnnotation = primaryRecord ? annotationMap.get(primaryRecord.id) ?? null : null
    const importNames = uniqueValues(
      relatedRecords.map((record) => importMap.get(record.importId)?.fileName ?? 'Unknown file'),
    )
    const projectKeys = uniqueValues(relatedRecords.map((record) => record.projectKey))
    const accountKeys = uniqueValues(relatedRecords.map((record) => record.accountKey))
    const sourceTypes = uniqueValues(relatedRecords.map((record) => record.sourceType)) as SourceType[]
    const searchText = [
      match.explanation,
      ...match.reasonCodes,
      match.provenance ?? 'engine',
      ...importNames,
      ...projectKeys,
      ...accountKeys,
      ...relatedRecords.map((record) => record.descriptionRaw),
      ...relatedRecords.map((record) => record.reference),
      ...relatedRecords.map((record) => record.note ?? ''),
      ...annotations.map((annotation) => annotation.note ?? ''),
      ...annotations.map((annotation) => annotation.reviewState),
    ]
      .join(' ')
      .toLowerCase()

    return {
      id: match.id,
      match,
      matchSource: match.provenance ?? 'engine',
      primaryRecord,
      primaryAnnotation,
      annotations,
      relatedRecords,
      importNames,
      projectKeys,
      accountKeys,
      sourceTypes,
      searchText,
    }
  })
}

export function buildAppPath(workspaceId: string, periodId: string, page: AppPage = 'queue') {
  return `/app/${workspaceId}/${periodId}/${page}`
}

export function resolveAppPage(pathname: string): AppPage {
  if (pathname.endsWith('/imports')) return 'imports'
  if (pathname.endsWith('/follow-up')) return 'follow-up'
  return 'queue'
}

export function downloadTextFile(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
