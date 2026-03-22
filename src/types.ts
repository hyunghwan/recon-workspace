import type { Transaction } from './data'

export type AppMode = 'demo' | 'cloud'

export type WorkspaceRecord = {
  id: string
  name: string
  owner_user_id: string
  created_at?: string
}

export type TransactionRecord = Omit<Transaction, 'activity'> & {
  workspace_id: string
  user_id: string
  activity: { at: string; text: string }[]
  created_at?: string
  updated_at?: string
}
