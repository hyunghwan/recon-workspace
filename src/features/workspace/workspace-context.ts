import { createContext, useContext } from 'react'

import type {
  ImportFormState,
  MatchCounts,
  PeriodBundle,
  ReconSnapshot,
  ReviewState,
  WorkspaceBundle,
} from '@/types'
import type { AppPage } from './workspace-utils'

export type WorkspaceContextValue = {
  authReady: boolean
  buildCurrentPath: (page?: AppPage) => string | null
  buildDefaultPath: (page?: AppPage) => string | null
  cloudEnabled: boolean
  cloudMessage: string
  currentPage: AppPage
  currentPeriodBundle: PeriodBundle | null
  currentPeriodId: string
  currentWorkspace: WorkspaceBundle | null
  currentWorkspaceId: string
  followUpSummary: string
  handleCreatePeriod: (monthKey: string) => void
  handleCreateWorkspace: (name: string) => void
  handleDeleteSampleWorkspace: () => Promise<void>
  handleDeleteImportBatch: (importId: string) => Promise<void>
  handleDeletePeriod: () => Promise<void>
  handleDeleteWorkspace: () => Promise<void>
  handleDirectSignIn: () => Promise<void>
  handleExportFollowUp: () => void
  handleImportBatch: (input: { file: File | null; form: ImportFormState }) => Promise<void>
  handleImportSignIn: () => Promise<void>
  handleManualSave: () => Promise<void>
  handleManualMatch: (input: { note?: string; recordIds: string[] }) => Promise<void>
  handleManualUnmatch: (input: { note?: string; recordIds: string[] }) => Promise<void>
  handleRenameWorkspace: (name: string) => Promise<void>
  handleSaveRecordAnnotation: (input: {
    note: string
    recordId: string
    reviewState: ReviewState
  }) => Promise<void>
  handleSignOut: () => Promise<void>
  importing: boolean
  isCurrentWorkspaceSample: boolean
  loadingCloud: boolean
  navigateToPeriod: (periodId: string) => void
  navigateToWorkspace: (workspaceId: string) => void
  routingReady: boolean
  selectedPeriodIdByWorkspace: Record<string, string>
  setCloudMessage: (message: string) => void
  setShowNewPeriodForm: (value: boolean) => void
  setShowNewWorkspaceForm: (value: boolean) => void
  showNewPeriodForm: boolean
  showNewWorkspaceForm: boolean
  snapshot: ReconSnapshot
  stats: MatchCounts | undefined
  syncing: boolean
  userEmail: string | null
  userSignedIn: boolean
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function useWorkspace() {
  const context = useContext(WorkspaceContext)

  if (!context) {
    throw new Error('useWorkspace must be used inside WorkspaceProvider.')
  }

  return context
}
