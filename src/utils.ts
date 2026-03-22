import type { Status, Transaction } from './data'

export function currency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(amount)
}

export function parseStatus(value: string): Status {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'matched') return 'matched'
  if (normalized === 'missing docs' || normalized === 'missing_docs') return 'missing docs'
  if (normalized === 'needs review' || normalized === 'needs_review') return 'needs review'
  if (normalized === 'exception') return 'exception'
  return 'ignored'
}

export function parseCsvTransactions(text: string): Transaction[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length <= 1) return []
  const [, ...rows] = lines
  return rows
    .map((row, index) => {
      const cols = row.split(',').map((col) => col.trim())
      const [date, merchant, memo, amount, source, status, matchedDocs, note] = cols
      if (!date || !merchant || !amount) return null
      return {
        id: `csv_${Date.now()}_${index}`,
        date,
        merchant,
        memo: memo || merchant,
        amount: Number(amount),
        source: source || 'Imported Source',
        status: parseStatus(status || 'needs review'),
        matchedDocs: Number(matchedDocs || 0),
        note: note || 'Imported from CSV',
        activity: [{ at: new Date().toLocaleString(), text: 'Imported from CSV file' }],
      } satisfies Transaction
    })
    .filter(Boolean) as Transaction[]
}

export function unresolvedSummary(items: Transaction[]) {
  const unresolved = items.filter((t) => ['missing docs', 'needs review', 'exception'].includes(t.status))
  if (!unresolved.length) return 'All transactions are currently resolved.'

  const lines = unresolved.map(
    (txn) => `- ${txn.date} | ${txn.merchant} | ${currency(txn.amount)} | ${txn.status} | ${txn.note}`,
  )

  return ['Unresolved reconciliation items:', ...lines].join('\n')
}
