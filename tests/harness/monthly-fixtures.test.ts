import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { monthlyFixtureDownloads } from '../../src/sample-csv-fixtures'
import { inferImportSourceType, parseImportFile, reconcileRecords } from '../../src/utils'

const fixturesDir = resolve(process.cwd(), 'public', 'fixtures')

function readFixture(fileName: string) {
  return readFileSync(resolve(fixturesDir, fileName), 'utf8')
}

describe('monthly CSV fixture pack', () => {
  it('keeps the realistic fixture pack available in the public fixtures directory', () => {
    expect(monthlyFixtureDownloads).toHaveLength(7)

    for (const fixture of monthlyFixtureDownloads) {
      expect(existsSync(resolve(fixturesDir, fixture.fileName))).toBe(true)
    }
  })

  it('infers the expected source type for each fixture and leaves the generic export for manual review', () => {
    for (const fixture of monthlyFixtureDownloads) {
      const inferred = inferImportSourceType({
        fileName: fixture.fileName,
        text: readFixture(fixture.fileName),
      })

      if (fixture.expectedSourceType) {
        expect(inferred).toMatchObject({
          inferredSourceType: fixture.expectedSourceType,
          inferenceStatus: 'inferred',
        })
      } else {
        expect(inferred).toEqual({
          inferredSourceType: null,
          inferenceStatus: 'needs_review',
          inferenceReason: 'Type needed',
        })
      }
    }
  })

  it('reconciles the realistic month pack into matched review and follow-up scenarios', async () => {
    const parsed = await Promise.all([
      parseImportFile({
        text: readFixture('acme-operating-bank-statement-2026-03.csv'),
        fileName: 'acme-operating-bank-statement-2026-03.csv',
        workspaceId: 'workspace-acme',
        periodId: 'period-mar',
        monthKey: '2026-03',
        sourceType: 'statement',
        projectKey: 'month-end',
        accountKey: 'operating-bank',
        defaultCurrency: 'USD',
        existingImports: [],
      }),
      parseImportFile({
        text: readFixture('acme-corporate-card-statement-2026-03.csv'),
        fileName: 'acme-corporate-card-statement-2026-03.csv',
        workspaceId: 'workspace-acme',
        periodId: 'period-mar',
        monthKey: '2026-03',
        sourceType: 'statement',
        projectKey: 'month-end',
        accountKey: 'corporate-card',
        defaultCurrency: 'USD',
        existingImports: [],
      }),
      parseImportFile({
        text: readFixture('acme-payroll-bank-statement-2026-03.csv'),
        fileName: 'acme-payroll-bank-statement-2026-03.csv',
        workspaceId: 'workspace-acme',
        periodId: 'period-mar',
        monthKey: '2026-03',
        sourceType: 'statement',
        projectKey: 'payroll',
        accountKey: 'payroll-bank',
        defaultCurrency: 'USD',
        existingImports: [],
      }),
      parseImportFile({
        text: readFixture('shopify-payouts-2026-03.csv'),
        fileName: 'shopify-payouts-2026-03.csv',
        workspaceId: 'workspace-acme',
        periodId: 'period-mar',
        monthKey: '2026-03',
        sourceType: 'payout',
        projectKey: 'ecommerce',
        accountKey: 'shopify-settlement',
        defaultCurrency: 'USD',
        existingImports: [],
      }),
      parseImportFile({
        text: readFixture('ap-vendor-invoices-2026-03.csv'),
        fileName: 'ap-vendor-invoices-2026-03.csv',
        workspaceId: 'workspace-acme',
        periodId: 'period-mar',
        monthKey: '2026-03',
        sourceType: 'supporting_csv',
        projectKey: 'ops',
        accountKey: 'ap-clearing',
        defaultCurrency: 'USD',
        existingImports: [],
      }),
      parseImportFile({
        text: readFixture('employee-expenses-2026-03.csv'),
        fileName: 'employee-expenses-2026-03.csv',
        workspaceId: 'workspace-acme',
        periodId: 'period-mar',
        monthKey: '2026-03',
        sourceType: 'supporting_csv',
        projectKey: 'sales-travel',
        accountKey: 'employee-expense-log',
        defaultCurrency: 'USD',
        existingImports: [],
      }),
    ])

    const records = parsed.flatMap((item) => item.records)
    const reconciled = reconcileRecords(records)

    expect(reconciled.matchCounts).toEqual({
      matched: 8,
      ambiguous: 1,
      unmatched: 5,
      exception: 1,
    })

    expect(reconciled.matches.some((match) => match.status === 'ambiguous' && match.explanation.includes('Delta client travel'))).toBe(true)
    expect(reconciled.matches.some((match) => match.status === 'exception' && match.explanation.includes('ATM cash withdrawal'))).toBe(true)
    expect(reconciled.matches.some((match) => match.status === 'unmatched' && match.explanation.includes('Bank fee monthly analysis'))).toBe(true)
  })
})
