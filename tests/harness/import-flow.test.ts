import { describe, expect, it } from 'vitest'

import {
  buildImportSelectionSummary,
  createDefaultImportForm,
  inferImportSourceType,
  parseImportFile,
} from '../../src/utils'

describe('import flow helpers', () => {
  it('starts the import form with blank optional metadata', () => {
    expect(createDefaultImportForm()).toEqual({
      projectKey: '',
      accountKey: '',
    })
  })

  it('falls back to general and unassigned when optional metadata is left blank', async () => {
    const parsed = await parseImportFile({
      text: 'date,amount,description\n2026-03-15,1250.25,Deposit',
      fileName: 'statement.csv',
      workspaceId: 'workspace-acme',
      periodId: 'period-mar',
      monthKey: '2026-03',
      sourceType: 'statement',
      projectKey: '',
      accountKey: '',
      defaultCurrency: 'USD',
      existingImports: [],
    })

    expect(parsed.batch.projectKey).toBe('general')
    expect(parsed.batch.accountKey).toBe('unassigned')
    expect(parsed.records).toHaveLength(1)
    expect(parsed.records[0]?.projectKey).toBe('general')
    expect(parsed.records[0]?.accountKey).toBe('unassigned')
  })

  it('builds a client, month, and file summary that stays easy to scan', () => {
    expect(
      buildImportSelectionSummary({
        clientName: 'Acme Books',
        monthName: 'March 2026',
        fileNames: ['statement-march.csv'],
      }),
    ).toEqual([
      { label: 'Client', value: 'Acme Books' },
      { label: 'Month', value: 'March 2026' },
      { label: 'File', value: 'statement-march.csv' },
    ])
  })

  it('summarizes multiple queued files compactly', () => {
    expect(
      buildImportSelectionSummary({
        clientName: 'Acme Books',
        monthName: 'March 2026',
        fileNames: ['statement.csv', 'payout.csv', 'supporting.csv'],
      }),
    ).toEqual([
      { label: 'Client', value: 'Acme Books' },
      { label: 'Month', value: 'March 2026' },
      { label: 'File', value: '3 files queued' },
    ])
  })

  it('infers source types from sample headers and file names', () => {
    expect(
      inferImportSourceType({
        fileName: 'northwind-statement.csv',
        text: 'date,description,merchant,amount,reference,group_key\n2026-03-06,Shopify payout 49822,Shopify,8421.62,49822,payout-49822',
      }),
    ).toMatchObject({
      inferredSourceType: 'statement',
      inferenceStatus: 'inferred',
    })

    expect(
      inferImportSourceType({
        fileName: 'shopify-payout.csv',
        text: 'date,description,counterparty,amount,payout_id,group_key\n2026-03-06,Shopify gross payout 49822,Shopify,8563.72,49822,payout-49822',
      }),
    ).toMatchObject({
      inferredSourceType: 'payout',
      inferenceStatus: 'inferred',
    })

    expect(
      inferImportSourceType({
        fileName: 'supporting-receipts.csv',
        text: 'date,description,vendor,amount,invoice_number,note\n2026-03-03,Adobe annual invoice,Adobe,659.88,adobe-2026,One-to-one exact support',
      }),
    ).toMatchObject({
      inferredSourceType: 'supporting_csv',
      inferenceStatus: 'inferred',
    })
  })

  it('marks generic CSV headers as needing a manual type', () => {
    expect(
      inferImportSourceType({
        fileName: 'march-export.csv',
        text: 'date,amount,description\n2026-03-15,1250.25,Deposit',
      }),
    ).toEqual({
      inferredSourceType: null,
      inferenceStatus: 'needs_review',
      inferenceReason: 'Type needed',
    })
  })
})
