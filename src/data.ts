import type {
  ImportBatchRecord,
  NormalizedRecord,
  ReconSnapshot,
  SourceType,
  WorkspaceBundle,
  WorkspaceRecord,
} from './types'
import { createEmptyPeriod, monthInputValue, rebuildPeriodBundle, safeKey } from './utils'

const demoOwnerId = 'demo-user'

function timestamp(day: string, hour = '09:00:00.000Z') {
  return `${day}T${hour}`
}

function createWorkspaceRecord(id: string, name: string): WorkspaceRecord {
  return {
    id,
    name,
    ownerUserId: demoOwnerId,
    defaultCurrency: 'USD',
    createdAt: timestamp('2026-03-01'),
    updatedAt: timestamp('2026-03-22'),
  }
}

function createImport(
  id: string,
  workspaceId: string,
  periodId: string,
  sourceType: SourceType,
  projectKey: string,
  accountKey: string,
  fileName: string,
  uploadedAt: string,
  rowCount: number,
): ImportBatchRecord {
  return {
    id,
    workspaceId,
    periodId,
    sourceType,
    projectKey,
    accountKey,
    fileName,
    storagePath: `sample/${workspaceId}/${periodId}/${fileName}`,
    uploadedAt,
    rowCount,
    parseStatus: 'parsed',
    hash: `${id}-hash`,
  }
}

function createRecord(input: {
  id: string
  workspaceId: string
  periodId: string
  importId: string
  lineNumber: number
  sourceType: SourceType
  projectKey: string
  accountKey: string
  txnDate: string
  postedDate?: string
  amount: number
  descriptionRaw: string
  counterparty: string
  reference?: string
  groupKey?: string
  note?: string
}): NormalizedRecord {
  return {
    id: input.id,
    workspaceId: input.workspaceId,
    periodId: input.periodId,
    importId: input.importId,
    lineNumber: input.lineNumber,
    sourceType: input.sourceType,
    projectKey: input.projectKey,
    accountKey: input.accountKey,
    txnDate: input.txnDate,
    postedDate: input.postedDate ?? input.txnDate,
    amount: input.amount,
    currency: 'USD',
    descriptionRaw: input.descriptionRaw,
    descriptionNorm: input.descriptionRaw.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
    counterpartyNorm: input.counterparty.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
    reference: (input.reference ?? '').toLowerCase(),
    groupKey: safeKey(input.groupKey ?? '', ''),
    matchStatus: 'unmatched',
    matchedRecordIds: [],
    note: input.note ?? null,
  }
}

function buildNorthwindWorkspace(): WorkspaceBundle {
  const workspace = createWorkspaceRecord('workspace_northwind', 'Northwind Goods')
  const marchPeriod = createEmptyPeriod(workspace.id, '2026-03')
  const februaryPeriod = createEmptyPeriod(workspace.id, '2026-02')

  const marchImports = [
    createImport(
      'imp_march_statement',
      workspace.id,
      marchPeriod.period.id,
      'statement',
      'month-end',
      'operating-bank',
      'northwind-march-statement.csv',
      timestamp('2026-03-08', '08:15:00.000Z'),
      5,
    ),
    createImport(
      'imp_march_payout',
      workspace.id,
      marchPeriod.period.id,
      'payout',
      'ecommerce',
      'shopify-settlement',
      'northwind-shopify-payouts.csv',
      timestamp('2026-03-08', '08:22:00.000Z'),
      2,
    ),
    createImport(
      'imp_march_ops_docs',
      workspace.id,
      marchPeriod.period.id,
      'supporting_csv',
      'ops',
      'ap-clearing',
      'northwind-ops-supporting.csv',
      timestamp('2026-03-08', '08:30:00.000Z'),
      1,
    ),
    createImport(
      'imp_march_travel_docs',
      workspace.id,
      marchPeriod.period.id,
      'supporting_csv',
      'sales-travel',
      'employee-expense-log',
      'northwind-travel-supporting.csv',
      timestamp('2026-03-08', '08:36:00.000Z'),
      3,
    ),
  ]

  const marchRecords = [
    createRecord({
      id: 'rec_stmt_1',
      workspaceId: workspace.id,
      periodId: marchPeriod.period.id,
      importId: 'imp_march_statement',
      lineNumber: 2,
      sourceType: 'statement',
      projectKey: 'ecommerce',
      accountKey: 'operating-bank',
      txnDate: '2026-03-06',
      amount: 8421.62,
      descriptionRaw: 'Shopify payout 49822',
      counterparty: 'Shopify',
      reference: '49822',
      groupKey: 'payout-49822',
    }),
    createRecord({
      id: 'rec_stmt_2',
      workspaceId: workspace.id,
      periodId: marchPeriod.period.id,
      importId: 'imp_march_statement',
      lineNumber: 3,
      sourceType: 'statement',
      projectKey: 'ops',
      accountKey: 'corporate-card',
      txnDate: '2026-03-03',
      amount: -659.88,
      descriptionRaw: 'Adobe Creative Cloud annual',
      counterparty: 'Adobe',
      reference: 'adobe-2026',
    }),
    createRecord({
      id: 'rec_stmt_3',
      workspaceId: workspace.id,
      periodId: marchPeriod.period.id,
      importId: 'imp_march_statement',
      lineNumber: 4,
      sourceType: 'statement',
      projectKey: 'sales-travel',
      accountKey: 'corporate-card',
      txnDate: '2026-03-04',
      amount: -438.21,
      descriptionRaw: 'Delta client travel',
      counterparty: 'Delta Air Lines',
    }),
    createRecord({
      id: 'rec_stmt_4',
      workspaceId: workspace.id,
      periodId: marchPeriod.period.id,
      importId: 'imp_march_statement',
      lineNumber: 5,
      sourceType: 'statement',
      projectKey: 'ops',
      accountKey: 'operating-bank',
      txnDate: '2026-03-08',
      amount: -300,
      descriptionRaw: 'ATM cash withdrawal',
      counterparty: 'Cash Withdrawal',
    }),
    createRecord({
      id: 'rec_stmt_5',
      workspaceId: workspace.id,
      periodId: marchPeriod.period.id,
      importId: 'imp_march_statement',
      lineNumber: 6,
      sourceType: 'statement',
      projectKey: 'ecommerce',
      accountKey: 'operating-bank',
      txnDate: '2026-03-02',
      amount: -182.44,
      descriptionRaw: 'Stripe fees March payout',
      counterparty: 'Stripe',
    }),
    createRecord({
      id: 'rec_payout_1',
      workspaceId: workspace.id,
      periodId: marchPeriod.period.id,
      importId: 'imp_march_payout',
      lineNumber: 2,
      sourceType: 'payout',
      projectKey: 'ecommerce',
      accountKey: 'shopify-settlement',
      txnDate: '2026-03-06',
      amount: 8563.72,
      descriptionRaw: 'Shopify gross payout 49822',
      counterparty: 'Shopify',
      reference: '49822',
      groupKey: 'payout-49822',
    }),
    createRecord({
      id: 'rec_payout_2',
      workspaceId: workspace.id,
      periodId: marchPeriod.period.id,
      importId: 'imp_march_payout',
      lineNumber: 3,
      sourceType: 'payout',
      projectKey: 'ecommerce',
      accountKey: 'shopify-settlement',
      txnDate: '2026-03-06',
      amount: -142.1,
      descriptionRaw: 'Returns adjustment payout 49822',
      counterparty: 'Shopify',
      reference: '49822',
      groupKey: 'payout-49822',
    }),
    createRecord({
      id: 'rec_support_1',
      workspaceId: workspace.id,
      periodId: marchPeriod.period.id,
      importId: 'imp_march_ops_docs',
      lineNumber: 2,
      sourceType: 'supporting_csv',
      projectKey: 'ops',
      accountKey: 'ap-clearing',
      txnDate: '2026-03-03',
      amount: 659.88,
      descriptionRaw: 'Adobe annual invoice',
      counterparty: 'Adobe',
      reference: 'adobe-2026',
    }),
    createRecord({
      id: 'rec_support_2',
      workspaceId: workspace.id,
      periodId: marchPeriod.period.id,
      importId: 'imp_march_travel_docs',
      lineNumber: 2,
      sourceType: 'supporting_csv',
      projectKey: 'sales-travel',
      accountKey: 'employee-expense-log',
      txnDate: '2026-03-04',
      amount: 438.21,
      descriptionRaw: 'Delta client travel receipt',
      counterparty: 'Delta Air Lines',
    }),
    createRecord({
      id: 'rec_support_3',
      workspaceId: workspace.id,
      periodId: marchPeriod.period.id,
      importId: 'imp_march_travel_docs',
      lineNumber: 3,
      sourceType: 'supporting_csv',
      projectKey: 'sales-travel',
      accountKey: 'employee-expense-log',
      txnDate: '2026-03-05',
      amount: 438.21,
      descriptionRaw: 'Delta backup travel receipt',
      counterparty: 'Delta Air Lines',
    }),
    createRecord({
      id: 'rec_support_4',
      workspaceId: workspace.id,
      periodId: marchPeriod.period.id,
      importId: 'imp_march_travel_docs',
      lineNumber: 4,
      sourceType: 'supporting_csv',
      projectKey: 'ops',
      accountKey: 'employee-expense-log',
      txnDate: '2026-03-08',
      amount: 280,
      descriptionRaw: 'Petty cash replenishment',
      counterparty: 'Cash Withdrawal',
    }),
  ]

  const februaryImports = [
    createImport(
      'imp_feb_statement',
      workspace.id,
      februaryPeriod.period.id,
      'statement',
      'month-end',
      'operating-bank',
      'northwind-february-statement.csv',
      timestamp('2026-02-28', '08:05:00.000Z'),
      2,
    ),
    createImport(
      'imp_feb_supporting',
      workspace.id,
      februaryPeriod.period.id,
      'supporting_csv',
      'ops',
      'ap-clearing',
      'northwind-february-supporting.csv',
      timestamp('2026-02-28', '08:20:00.000Z'),
      2,
    ),
  ]

  const februaryRecords = [
    createRecord({
      id: 'rec_feb_stmt_1',
      workspaceId: workspace.id,
      periodId: februaryPeriod.period.id,
      importId: 'imp_feb_statement',
      lineNumber: 2,
      sourceType: 'statement',
      projectKey: 'ops',
      accountKey: 'corporate-card',
      txnDate: '2026-02-14',
      amount: -96,
      descriptionRaw: 'Notion workspace billing',
      counterparty: 'Notion',
      reference: 'notion-feb',
    }),
    createRecord({
      id: 'rec_feb_stmt_2',
      workspaceId: workspace.id,
      periodId: februaryPeriod.period.id,
      importId: 'imp_feb_statement',
      lineNumber: 3,
      sourceType: 'statement',
      projectKey: 'ops',
      accountKey: 'operating-bank',
      txnDate: '2026-02-19',
      amount: -245,
      descriptionRaw: 'Office supply run',
      counterparty: 'Staples',
    }),
    createRecord({
      id: 'rec_feb_doc_1',
      workspaceId: workspace.id,
      periodId: februaryPeriod.period.id,
      importId: 'imp_feb_supporting',
      lineNumber: 2,
      sourceType: 'supporting_csv',
      projectKey: 'ops',
      accountKey: 'ap-clearing',
      txnDate: '2026-02-14',
      amount: 96,
      descriptionRaw: 'Notion receipt',
      counterparty: 'Notion',
      reference: 'notion-feb',
    }),
    createRecord({
      id: 'rec_feb_doc_2',
      workspaceId: workspace.id,
      periodId: februaryPeriod.period.id,
      importId: 'imp_feb_supporting',
      lineNumber: 3,
      sourceType: 'supporting_csv',
      projectKey: 'ops',
      accountKey: 'ap-clearing',
      txnDate: '2026-02-20',
      amount: 245,
      descriptionRaw: 'Office supply receipt',
      counterparty: 'Staples',
    }),
  ]

  return {
    workspace,
    periods: [
      rebuildPeriodBundle(marchPeriod.period, marchImports, marchRecords),
      rebuildPeriodBundle(februaryPeriod.period, februaryImports, februaryRecords),
    ],
  }
}

export function createSampleSnapshot(): ReconSnapshot {
  return {
    workspaces: [buildNorthwindWorkspace()],
  }
}

export function createBlankWorkspaceBundle(name: string, ownerUserId: string): WorkspaceBundle {
  const workspaceId = `workspace_${safeKey(name, crypto.randomUUID())}`
  const now = new Date().toISOString()
  const workspace: WorkspaceRecord = {
    id: workspaceId,
    name: name.trim() || 'New workspace',
    ownerUserId,
    defaultCurrency: 'USD',
    createdAt: now,
    updatedAt: now,
  }

  const firstPeriod = createEmptyPeriod(workspaceId, monthInputValue())

  return {
    workspace,
    periods: [firstPeriod],
  }
}
