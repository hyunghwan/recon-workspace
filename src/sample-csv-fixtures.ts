import type { SourceType } from './types'

export type SampleCsvDownload = {
  label: string
  href: string
}

export type MonthlyCsvFixture = SampleCsvDownload & {
  fileName: string
  expectedSourceType: SourceType | null
}

export const sampleTemplateDownloads: SampleCsvDownload[] = [
  {
    label: 'Statement template',
    href: '/sample-statement.csv',
  },
  {
    label: 'Payout template',
    href: '/sample-payout.csv',
  },
  {
    label: 'Supporting template',
    href: '/sample-supporting.csv',
  },
]

export const monthlyFixtureDownloads: MonthlyCsvFixture[] = [
  {
    label: 'Operating bank statement',
    fileName: 'acme-operating-bank-statement-2026-03.csv',
    href: '/fixtures/acme-operating-bank-statement-2026-03.csv',
    expectedSourceType: 'statement',
  },
  {
    label: 'Corporate card statement',
    fileName: 'acme-corporate-card-statement-2026-03.csv',
    href: '/fixtures/acme-corporate-card-statement-2026-03.csv',
    expectedSourceType: 'statement',
  },
  {
    label: 'Payroll bank statement',
    fileName: 'acme-payroll-bank-statement-2026-03.csv',
    href: '/fixtures/acme-payroll-bank-statement-2026-03.csv',
    expectedSourceType: 'statement',
  },
  {
    label: 'Shopify payouts',
    fileName: 'shopify-payouts-2026-03.csv',
    href: '/fixtures/shopify-payouts-2026-03.csv',
    expectedSourceType: 'payout',
  },
  {
    label: 'AP vendor invoices',
    fileName: 'ap-vendor-invoices-2026-03.csv',
    href: '/fixtures/ap-vendor-invoices-2026-03.csv',
    expectedSourceType: 'supporting_csv',
  },
  {
    label: 'Employee expenses',
    fileName: 'employee-expenses-2026-03.csv',
    href: '/fixtures/employee-expenses-2026-03.csv',
    expectedSourceType: 'supporting_csv',
  },
  {
    label: 'Generic export',
    fileName: 'march-export.csv',
    href: '/fixtures/march-export.csv',
    expectedSourceType: null,
  },
]
