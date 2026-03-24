import { mkdir, readFile, writeFile } from 'node:fs/promises'

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const projectId = 'demo-recon-workspace'
const evidenceDir = '.sisyphus/evidence'
const successLines: string[] = []
const failureLines: string[] = []

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  const [firestoreRules, storageRules] = await Promise.all([
    readFile('firestore.rules', 'utf8'),
    readFile('storage.rules', 'utf8'),
  ])

  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules: firestoreRules },
    storage: { rules: storageRules },
  })

  await mkdir(evidenceDir, { recursive: true })
})

afterAll(async () => {
  await writeFile(
    `${evidenceDir}/task-7-firebase-regression.txt`,
    [
      'Task 7 Firebase Regression Evidence',
      '',
      'Command:',
      '  pnpm test:firebase',
      '',
      'Covered cases:',
      ...successLines.map((line) => `- ${line}`),
      '',
      'Environment:',
      `  FIREBASE_EMULATOR_HUB=${process.env.FIREBASE_EMULATOR_HUB ?? 'missing'}`,
      `  FIRESTORE_EMULATOR_HOST=${process.env.FIRESTORE_EMULATOR_HOST ?? 'missing'}`,
      `  FIREBASE_STORAGE_EMULATOR_HOST=${process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? 'missing'}`,
    ].join('\n'),
  )

  await writeFile(
    `${evidenceDir}/task-7-firebase-regression-error.txt`,
    [
      'Task 7 Firebase Regression Failure-Path Evidence',
      '',
      'Negative cases executed:',
      ...failureLines.map((line) => `- ${line}`),
      '',
      'Expected outcome:',
      '  Each negative case returns permission-denied or keeps sibling month/workspace data intact.',
    ].join('\n'),
  )

  await testEnv.cleanup()
})

describe('firebase emulator regression coverage', () => {
  it('denies signed-out writes to protected workspace documents', async () => {
    const unauthed = testEnv.unauthenticatedContext()
    const db = unauthed.firestore()

    await assertFails(
      db.doc('users/owner/workspaces/workspace-a').set({
        id: 'workspace-a',
        name: 'Acme Holdings',
        ownerUserId: 'owner',
      }),
    )

    failureLines.push('Signed-out users cannot write workspace records.')
  })

  it('allows an owner to write and read their own workspace month data', async () => {
    const owner = testEnv.authenticatedContext('owner')
    const db = owner.firestore()

    await assertSucceeds(
      db.doc('users/owner/workspaces/workspace-a').set({
        id: 'workspace-a',
        name: 'Acme Holdings',
        ownerUserId: 'owner',
      }),
    )
    await assertSucceeds(
      db.doc('users/owner/workspaces/workspace-a/periods/period-mar').set({
        id: 'period-mar',
        workspaceId: 'workspace-a',
        monthKey: '2026-03',
      }),
    )

    const snapshot = await assertSucceeds(
      db.doc('users/owner/workspaces/workspace-a/periods/period-mar').get(),
    )

    expect(snapshot.exists).toBe(true)
    successLines.push('Owner writes and reads the selected client month successfully.')
  })

  it('blocks non-owners from writing another owner’s Firestore records', async () => {
    const intruder = testEnv.authenticatedContext('intruder')
    const db = intruder.firestore()

    await assertFails(
      db.doc('users/owner/workspaces/workspace-a').set({
        id: 'workspace-a',
        name: 'Hijack Attempt',
        ownerUserId: 'intruder',
      }),
    )

    failureLines.push('Non-owners cannot overwrite another client workspace.')
  })

  it('allows owner uploads and denies non-owner uploads to import storage paths', async () => {
    const ownerStorage = testEnv.authenticatedContext('owner').storage('gs://demo-recon-workspace.appspot.com')
    const intruderStorage = testEnv.authenticatedContext('intruder').storage('gs://demo-recon-workspace.appspot.com')
    const ownerRef = ownerStorage.ref('users/owner/workspaces/workspace-a/periods/period-mar/imports/imp-1/statement.csv')
    const intruderRef = intruderStorage.ref('users/owner/workspaces/workspace-a/periods/period-mar/imports/imp-2/statement.csv')

    await assertSucceeds(ownerRef.putString('date,amount\n2026-03-01,100\n', 'raw', { contentType: 'text/csv' }))
    await assertFails(intruderRef.putString('date,amount\n2026-03-01,100\n', 'raw', { contentType: 'text/csv' }))

    successLines.push('Owner upload succeeds for a month import path.')
    failureLines.push('Non-owner upload is denied for another owner’s import path.')
  })

  it('preserves sibling months and sibling workspaces during targeted month updates', async () => {
    await testEnv.clearFirestore()

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore()

      await Promise.all([
        db.doc('users/owner/workspaces/workspace-a').set({ id: 'workspace-a', name: 'Acme Holdings', ownerUserId: 'owner' }),
        db.doc('users/owner/workspaces/workspace-b').set({ id: 'workspace-b', name: 'Beta Retail', ownerUserId: 'owner' }),
        db.doc('users/owner/workspaces/workspace-a/periods/period-mar').set({ id: 'period-mar', monthKey: '2026-03' }),
        db.doc('users/owner/workspaces/workspace-a/periods/period-feb').set({ id: 'period-feb', monthKey: '2026-02' }),
        db.doc('users/owner/workspaces/workspace-b/periods/period-mar').set({ id: 'period-mar', monthKey: '2026-03' }),
        db.doc('users/owner/workspaces/workspace-a/periods/period-mar/records/rec-mar').set({ id: 'rec-mar', amount: 100 }),
        db.doc('users/owner/workspaces/workspace-a/periods/period-feb/records/rec-feb').set({ id: 'rec-feb', amount: 200 }),
        db.doc('users/owner/workspaces/workspace-b/periods/period-mar/records/rec-other').set({ id: 'rec-other', amount: 300 }),
      ])
    })

    const owner = testEnv.authenticatedContext('owner')
    const db = owner.firestore()

    await assertSucceeds(
      db.doc('users/owner/workspaces/workspace-a/periods/period-mar').set({
        id: 'period-mar',
        monthKey: '2026-03',
        updatedAt: '2026-03-23T00:00:00.000Z',
      }),
    )
    await assertSucceeds(
      db.doc('users/owner/workspaces/workspace-a/periods/period-mar/records/rec-mar').set({
        id: 'rec-mar',
        amount: 125,
      }),
    )

    const [siblingMonthRecord, siblingWorkspaceRecord] = await Promise.all([
      assertSucceeds(db.doc('users/owner/workspaces/workspace-a/periods/period-feb/records/rec-feb').get()),
      assertSucceeds(db.doc('users/owner/workspaces/workspace-b/periods/period-mar/records/rec-other').get()),
    ])

    expect(siblingMonthRecord.exists).toBe(true)
    expect(siblingWorkspaceRecord.exists).toBe(true)

    successLines.push('Targeted month updates keep sibling months and sibling workspaces untouched.')
    failureLines.push('Sibling data would disappear here if destructive sync leaked outside the active month.')
  })
})
