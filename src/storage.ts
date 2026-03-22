import type { Transaction } from './data'

const KEY = 'recon-workspace-transactions-v1'

export function loadTransactions(): Transaction[] | null {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    return JSON.parse(raw) as Transaction[]
  } catch {
    return null
  }
}

export function saveTransactions(transactions: Transaction[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(transactions))
  } catch {
    // ignore storage errors in MVP
  }
}
