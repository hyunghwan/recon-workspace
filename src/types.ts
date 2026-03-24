export type SourceType = 'statement' | 'payout' | 'supporting_csv'

export type MatchStatus = 'matched' | 'ambiguous' | 'unmatched' | 'exception'

export type MatchType = 'one_to_one' | 'one_to_many' | 'many_to_one'

export type ConfidenceBand = 'high' | 'medium' | 'low'

export type PeriodStatus = 'draft' | 'in_progress' | 'ready_for_review'

export type ParseStatus = 'parsed' | 'duplicate_skipped' | 'parse_error'

export type QueueView = MatchStatus | 'all'

export type ReviewState = 'none' | 'reviewed' | 'needs_follow_up'

export type ManualOverrideKind = 'manual_match' | 'manual_unmatch'

export type MatchProvenance = 'engine' | 'manual_match' | 'manual_unmatch'

export type WorkspaceOrigin = 'sample' | 'user'

export type WorkspaceRecord = {
  id: string
  name: string
  ownerUserId: string
  origin: WorkspaceOrigin
  defaultCurrency: string
  createdAt: string
  updatedAt: string
}

export type SourceCounts = Record<SourceType, number>

export type MatchCounts = Record<MatchStatus, number>

export type PeriodRecord = {
  id: string
  workspaceId: string
  monthKey: string
  quarterKey: string
  status: PeriodStatus
  recordCounts: {
    total: number
    bySourceType: SourceCounts
  }
  matchCounts: MatchCounts
  lastReconciledAt?: string
  createdAt: string
  updatedAt: string
}

export type ImportBatchRecord = {
  id: string
  workspaceId: string
  periodId: string
  sourceType: SourceType
  projectKey: string
  accountKey: string
  fileName: string
  storagePath: string
  uploadedAt: string
  rowCount: number
  parseStatus: ParseStatus
  hash: string
}

export type NormalizedRecord = {
  id: string
  workspaceId: string
  periodId: string
  importId: string
  lineNumber: number
  sourceType: SourceType
  projectKey: string
  accountKey: string
  txnDate: string
  postedDate: string
  amount: number
  currency: string
  descriptionRaw: string
  descriptionNorm: string
  counterpartyNorm: string
  reference: string
  groupKey: string
  matchStatus: MatchStatus
  matchedRecordIds: string[]
  note: string | null
}

export type MatchResultRecord = {
  id: string
  workspaceId: string
  periodId: string
  matchType: MatchType
  recordIds: string[]
  status: MatchStatus
  score: number
  confidenceBand: ConfidenceBand
  reasonCodes: string[]
  explanation: string
  varianceAmount: number
  provenance?: MatchProvenance
  overrideId?: string | null
  createdAt: string
  updatedAt: string
}

export type RecordAnnotation = {
  recordId: string
  note: string | null
  reviewState: ReviewState
  updatedAt: string
  updatedBy: string
}

export type ManualMatchOverride = {
  id: string
  periodId: string
  kind: ManualOverrideKind
  recordIds: string[]
  note: string | null
  createdAt: string
  updatedAt: string
  createdBy: string
}

export type PeriodBundle = {
  period: PeriodRecord
  imports: ImportBatchRecord[]
  records: NormalizedRecord[]
  matches: MatchResultRecord[]
  annotations: RecordAnnotation[]
  manualOverrides: ManualMatchOverride[]
}

export type WorkspaceBundle = {
  workspace: WorkspaceRecord
  periods: PeriodBundle[]
}

export type ReconSnapshot = {
  workspaces: WorkspaceBundle[]
}

export type UserWorkspacePreferences = {
  sampleDismissedAt?: string | null
  sampleSeededAt?: string | null
}

export type ImportFormState = {
  sourceType: SourceType
  projectKey: string
  accountKey: string
}

export type ParsedImport = {
  batch: ImportBatchRecord
  records: NormalizedRecord[]
  duplicateOfImportId?: string
}
