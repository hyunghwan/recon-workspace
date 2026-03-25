import { describe, expect, it } from 'vitest'

import { resolveWorkspaceRouteParams } from '../../src/features/workspace/workspace-route-params'

describe('resolveWorkspaceRouteParams', () => {
  it('reads workspace and period ids from nested workspace routes', () => {
    expect(resolveWorkspaceRouteParams('/app/workspace_acme/period_2026-03/queue')).toEqual({
      periodId: 'period_2026-03',
      workspaceId: 'workspace_acme',
    })
    expect(resolveWorkspaceRouteParams('/app/workspace_beta/period_2026-02')).toEqual({
      periodId: 'period_2026-02',
      workspaceId: 'workspace_beta',
    })
  })

  it('returns empty params outside the workspace route shape', () => {
    expect(resolveWorkspaceRouteParams('/')).toEqual({
      periodId: undefined,
      workspaceId: undefined,
    })
    expect(resolveWorkspaceRouteParams('/marketing')).toEqual({
      periodId: undefined,
      workspaceId: undefined,
    })
  })
})
