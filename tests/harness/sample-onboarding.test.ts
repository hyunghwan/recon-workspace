import { describe, expect, it } from 'vitest'

import { createBlankWorkspaceBundle, createEmptySnapshot, createSampleSnapshot } from '../../src/data'
import {
  getPreferredWorkspaceBundle,
  isSampleWorkspaceRecord,
  shouldAutoSeedSampleWorkspace,
} from '../../src/features/workspace/workspace-onboarding'

describe('sample onboarding helpers', () => {
  it('auto-seeds the sample workspace only for a first signed-in empty account', () => {
    expect(shouldAutoSeedSampleWorkspace(createEmptySnapshot(), {})).toBe(true)
    expect(
      shouldAutoSeedSampleWorkspace(createEmptySnapshot(), {
        sampleSeededAt: '2026-03-24T00:00:00.000Z',
      }),
    ).toBe(false)
    expect(
      shouldAutoSeedSampleWorkspace(createEmptySnapshot(), {
        sampleDismissedAt: '2026-03-24T00:00:00.000Z',
      }),
    ).toBe(false)
  })

  it('marks seeded sample workspaces distinctly from user workspaces', () => {
    const sampleSnapshot = createSampleSnapshot('owner-123')
    const sampleWorkspace = sampleSnapshot.workspaces[0]?.workspace
    const userWorkspace = createBlankWorkspaceBundle('Acme Books', 'owner-123').workspace

    expect(sampleWorkspace?.ownerUserId).toBe('owner-123')
    expect(isSampleWorkspaceRecord(sampleWorkspace)).toBe(true)
    expect(isSampleWorkspaceRecord(userWorkspace)).toBe(false)
  })

  it('prefers a user workspace over the sample workspace when choosing the default landing target', () => {
    const sampleWorkspace = createSampleSnapshot('owner-123').workspaces[0]
    const userWorkspace = createBlankWorkspaceBundle('Acme Books', 'owner-123')
    const preferredWorkspace = getPreferredWorkspaceBundle({
      workspaces: [sampleWorkspace, userWorkspace],
    })

    expect(preferredWorkspace?.workspace.name).toBe('Acme Books')
  })
})
