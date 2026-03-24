import type {
  ReconSnapshot,
  UserWorkspacePreferences,
  WorkspaceBundle,
  WorkspaceRecord,
} from '@/types'

export function getWorkspaceOrigin(workspace: WorkspaceRecord | null | undefined) {
  return workspace?.origin ?? 'user'
}

export function isSampleWorkspaceRecord(workspace: WorkspaceRecord | null | undefined) {
  return getWorkspaceOrigin(workspace) === 'sample'
}

export function getPreferredWorkspaceBundle(snapshot: ReconSnapshot): WorkspaceBundle | null {
  const workspacesWithPeriods = snapshot.workspaces.filter((workspaceBundle) => workspaceBundle.periods.length > 0)
  const candidates = workspacesWithPeriods.length ? workspacesWithPeriods : snapshot.workspaces

  return candidates.find((workspaceBundle) => !isSampleWorkspaceRecord(workspaceBundle.workspace)) ?? candidates[0] ?? null
}

export function shouldAutoSeedSampleWorkspace(
  snapshot: ReconSnapshot,
  preferences: UserWorkspacePreferences,
) {
  return (
    snapshot.workspaces.length === 0 &&
    !preferences.sampleDismissedAt &&
    !preferences.sampleSeededAt
  )
}
