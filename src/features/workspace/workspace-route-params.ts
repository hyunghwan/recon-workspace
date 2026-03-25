export function resolveWorkspaceRouteParams(pathname: string) {
  const [appSegment, workspaceId, periodId] = pathname.split('/').filter(Boolean)

  if (appSegment !== 'app') {
    return {
      periodId: undefined,
      workspaceId: undefined,
    }
  }

  return {
    periodId,
    workspaceId,
  }
}
