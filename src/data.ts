export type Status = 'matched' | 'missing docs' | 'needs review' | 'exception' | 'ignored'

export type Transaction = {
  id: string
  date: string
  merchant: string
  memo: string
  amount: number
  source: string
  status: Status
  matchedDocs: number
  note: string
  activity: { at: string; text: string }[]
}

export const transactions: Transaction[] = [
  {
    id: 'txn_001',
    date: '2026-03-02',
    merchant: 'Stripe Fees',
    memo: 'March payout fees',
    amount: -182.44,
    source: 'Operating Bank',
    status: 'needs review',
    matchedDocs: 0,
    note: 'Expected payout support exists, but fee breakdown is not attached yet.',
    activity: [
      { at: 'Mar 2, 09:12', text: 'Imported from March operating bank statement' },
      { at: 'Mar 2, 09:16', text: 'Flagged for fee reconciliation review' },
    ],
  },
  {
    id: 'txn_002',
    date: '2026-03-03',
    merchant: 'Adobe',
    memo: 'Creative Cloud annual plan',
    amount: -659.88,
    source: 'Corporate Card',
    status: 'matched',
    matchedDocs: 1,
    note: 'Vendor invoice attached and approved.',
    activity: [
      { at: 'Mar 3, 10:02', text: 'Matched to invoice adobe-annual-2026.pdf' },
      { at: 'Mar 3, 10:18', text: 'Marked ready for close' },
    ],
  },
  {
    id: 'txn_003',
    date: '2026-03-04',
    merchant: 'Delta Air Lines',
    memo: 'Client travel',
    amount: -438.21,
    source: 'Corporate Card',
    status: 'missing docs',
    matchedDocs: 0,
    note: 'Need receipt and business purpose from client lead.',
    activity: [
      { at: 'Mar 4, 08:41', text: 'Imported from card statement' },
      { at: 'Mar 4, 08:45', text: 'Missing supporting docs request drafted' },
    ],
  },
  {
    id: 'txn_004',
    date: '2026-03-06',
    merchant: 'Shopify Payout',
    memo: 'Payout #49822',
    amount: 8421.62,
    source: 'Operating Bank',
    status: 'exception',
    matchedDocs: 2,
    note: 'Deposit amount does not match expected payout summary after returns.',
    activity: [
      { at: 'Mar 6, 11:12', text: 'Matched to payout export and returns report' },
      { at: 'Mar 6, 11:29', text: 'Variance of $142.10 detected' },
    ],
  },
  {
    id: 'txn_005',
    date: '2026-03-07',
    merchant: 'Notion',
    memo: 'Workspace billing',
    amount: -96,
    source: 'Corporate Card',
    status: 'matched',
    matchedDocs: 1,
    note: 'Recurring SaaS expense. Auto-recognized vendor.',
    activity: [
      { at: 'Mar 7, 09:05', text: 'Matched to emailed receipt' },
    ],
  },
  {
    id: 'txn_006',
    date: '2026-03-08',
    merchant: 'Cash Withdrawal',
    memo: 'ATM withdrawal',
    amount: -300,
    source: 'Operating Bank',
    status: 'needs review',
    matchedDocs: 0,
    note: 'No explanation attached. Confirm owner draw vs reimbursable spend.',
    activity: [
      { at: 'Mar 8, 15:44', text: 'Imported from bank feed' },
    ],
  },
]

export const statusOrder: Status[] = ['matched', 'missing docs', 'needs review', 'exception', 'ignored']
