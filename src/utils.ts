import type {
  ConfidenceBand,
  ImportBatchRecord,
  ImportInferenceStatus,
  ImportFormState,
  MatchCounts,
  MatchProvenance,
  MatchResultRecord,
  MatchStatus,
  MatchType,
  ManualMatchOverride,
  NormalizedRecord,
  ParsedImport,
  PeriodBundle,
  PeriodRecord,
  RecordAnnotation,
  SourceCounts,
  SourceType,
} from './types'

const exactAmountTolerance = 0.01
const amountVarianceTolerance = 50
const dateWindowDays = 3

type CandidateEvaluation = {
  candidate: NormalizedRecord
  score: number
  dateDistance: number
  amountDiff: number
  exactAmount: boolean
  signMismatch: boolean
  reasons: string[]
}

type ParseImportOptions = {
  text: string
  fileName: string
  workspaceId: string
  periodId: string
  monthKey: string
  sourceType: SourceType
  projectKey: string
  accountKey: string
  defaultCurrency: string
  existingImports: ImportBatchRecord[]
}

const sourceLabelMap: Record<SourceType, string> = {
  statement: 'Statement',
  payout: 'Payout',
  supporting_csv: 'Supporting File',
}

const matchStatusLabelMap: Record<MatchStatus, string> = {
  matched: 'Ready',
  ambiguous: 'Needs review',
  unmatched: 'Needs support',
  exception: 'Needs attention',
}

export const sourceTypeOrder: SourceType[] = ['statement', 'payout', 'supporting_csv']

export const matchStatusOrder: MatchStatus[] = ['ambiguous', 'unmatched', 'exception', 'matched']

export function createDefaultImportForm(): ImportFormState {
  return {
    projectKey: '',
    accountKey: '',
  }
}

export function buildImportSelectionSummary(input: {
  clientName: string
  monthName: string
  fileNames?: string[]
}) {
  const fileNames = input.fileNames?.filter(Boolean) ?? []
  const fileValue =
    fileNames.length === 0
      ? 'No files selected'
      : fileNames.length === 1
        ? fileNames[0]
        : `${fileNames.length} files queued`

  return [
    {
      label: 'Client' as const,
      value: input.clientName.trim() || 'Choose a client',
    },
    {
      label: 'Month' as const,
      value: input.monthName.trim() || 'Choose a month',
    },
    {
      label: 'File' as const,
      value: fileValue,
    },
  ]
}

export function emptySourceCounts(): SourceCounts {
  return {
    statement: 0,
    payout: 0,
    supporting_csv: 0,
  }
}

export function emptyMatchCounts(): MatchCounts {
  return {
    matched: 0,
    ambiguous: 0,
    unmatched: 0,
    exception: 0,
  }
}

export function sourceTypeLabel(sourceType: SourceType) {
  return sourceLabelMap[sourceType]
}

export function matchStatusLabel(status: MatchStatus) {
  return matchStatusLabelMap[status]
}

export function currency(amount: number, currencyCode = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function quarterKeyForMonth(monthKey: string) {
  const [, monthPart] = monthKey.split('-')
  const month = Number(monthPart)
  const quarter = Math.floor((month - 1) / 3) + 1
  return `${monthKey.slice(0, 4)}-Q${quarter}`
}

export function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)))
}

export function safeKey(value: string, fallback: string) {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return normalized || fallback
}

export function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeHeader(value: string) {
  return normalizeText(value).replace(/\s+/g, '_')
}

function createSourceTypeScoreMap() {
  return {
    statement: 0,
    payout: 0,
    supporting_csv: 0,
  } satisfies Record<SourceType, number>
}

function createSourceTypeReasonMap() {
  return {
    statement: [] as string[],
    payout: [] as string[],
    supporting_csv: [] as string[],
  } satisfies Record<SourceType, string[]>
}

function addSourceTypeSignal(
  scores: Record<SourceType, number>,
  reasons: Record<SourceType, string[]>,
  sourceType: SourceType,
  value: number,
  reason: string,
) {
  scores[sourceType] += value
  reasons[sourceType].push(reason)
}

function isoNow() {
  return new Date().toISOString()
}

function hashString(input: string) {
  const encoder = new TextEncoder()
  return crypto.subtle.digest('SHA-256', encoder.encode(input)).then((buffer) => {
    return Array.from(new Uint8Array(buffer))
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('')
  })
}

function parseCsvRows(text: string) {
  const rows: string[][] = []
  let current = ''
  let row: string[] = []
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      row.push(current.trim())
      current = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        index += 1
      }

      row.push(current.trim())
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row)
      }
      row = []
      current = ''
      continue
    }

    current += char
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current.trim())
    if (row.some((cell) => cell.length > 0)) {
      rows.push(row)
    }
  }

  return rows
}

function buildHeaderMap(headerRow: string[]) {
  const map = new Map<string, number>()

  headerRow.forEach((cell, index) => {
    map.set(normalizeHeader(cell), index)
  })

  return map
}

export function inferImportSourceType(input: {
  fileName: string
  text?: string
}): {
  inferredSourceType: SourceType | null
  inferenceStatus: ImportInferenceStatus
  inferenceReason: string
} {
  const scores = createSourceTypeScoreMap()
  const reasons = createSourceTypeReasonMap()
  const fileTokens = new Set(normalizeText(input.fileName.replace(/\.csv$/i, '')).split(' ').filter(Boolean))
  const headerRow = input.text ? parseCsvRows(input.text)[0] ?? [] : []
  const headers = new Set(headerRow.map((cell) => normalizeHeader(cell)).filter(Boolean))

  if (headers.has('merchant')) {
    addSourceTypeSignal(scores, reasons, 'statement', 4, 'merchant column')
  }
  if (headers.has('reference')) {
    addSourceTypeSignal(scores, reasons, 'statement', 4, 'reference column')
  }
  if (headers.has('counterparty')) {
    addSourceTypeSignal(scores, reasons, 'payout', 3, 'counterparty column')
  }
  if (headers.has('payout_id')) {
    addSourceTypeSignal(scores, reasons, 'payout', 5, 'payout_id column')
  }
  if (headers.has('vendor')) {
    addSourceTypeSignal(scores, reasons, 'supporting_csv', 4, 'vendor column')
  }
  if (headers.has('invoice_number')) {
    addSourceTypeSignal(scores, reasons, 'supporting_csv', 5, 'invoice_number column')
  }
  if (headers.has('note')) {
    addSourceTypeSignal(scores, reasons, 'supporting_csv', 2, 'note column')
  }
  if (headers.has('group_key')) {
    addSourceTypeSignal(scores, reasons, 'statement', 1, 'group_key column')
    addSourceTypeSignal(scores, reasons, 'payout', 1, 'group_key column')
  }

  if (fileTokens.has('statement') || fileTokens.has('bank')) {
    addSourceTypeSignal(scores, reasons, 'statement', 3, 'statement file name')
  }
  if (fileTokens.has('payout') || fileTokens.has('settlement')) {
    addSourceTypeSignal(scores, reasons, 'payout', 3, 'payout file name')
  }
  if (
    fileTokens.has('supporting') ||
    fileTokens.has('support') ||
    fileTokens.has('invoice') ||
    fileTokens.has('receipt') ||
    fileTokens.has('bill')
  ) {
    addSourceTypeSignal(scores, reasons, 'supporting_csv', 3, 'supporting file name')
  }

  const ranked = sourceTypeOrder
    .map((sourceType) => ({
      sourceType,
      score: scores[sourceType],
      reasons: reasons[sourceType],
    }))
    .sort((left, right) => right.score - left.score)

  const [top, next] = ranked

  if (!top || top.score === 0 || (next && top.score - next.score < 2)) {
    return {
      inferredSourceType: null,
      inferenceStatus: 'needs_review',
      inferenceReason: 'Type needed',
    }
  }

  return {
    inferredSourceType: top.sourceType,
    inferenceStatus: 'inferred',
    inferenceReason: `Auto-detected from ${top.reasons[0] ?? 'file structure'}.`,
  }
}

function readColumn(row: string[], headerMap: Map<string, number>, aliases: string[]) {
  for (const alias of aliases) {
    const index = headerMap.get(alias)
    if (index != null) {
      return row[index]?.trim() ?? ''
    }
  }

  return ''
}

function parseDateValue(value: string, fallbackMonthKey?: string) {
  if (!value && fallbackMonthKey) {
    return `${fallbackMonthKey}-01`
  }

  if (!value) return ''

  const normalized = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return ''

  return parsed.toISOString().slice(0, 10)
}

function parseAmountValue(value: string) {
  const cleaned = value.replace(/[$,\s]/g, '').replace(/^\((.*)\)$/, '-$1')
  const amount = Number(cleaned)
  return Number.isFinite(amount) ? amount : Number.NaN
}

function parseRecordRow(
  row: string[],
  lineNumber: number,
  headerMap: Map<string, number>,
  options: Omit<ParseImportOptions, 'text' | 'fileName' | 'existingImports'> & { importId: string },
) {
  const common = {
    workspaceId: options.workspaceId,
    periodId: options.periodId,
    importId: options.importId,
    lineNumber,
    sourceType: options.sourceType,
    projectKey: safeKey(options.projectKey, 'general'),
    accountKey: safeKey(options.accountKey, 'unassigned'),
    currency: options.defaultCurrency,
  }

  const rawDate = readColumn(row, headerMap, ['date', 'transaction_date', 'txn_date', 'created_at'])
  const postedDate = readColumn(row, headerMap, ['posted_date', 'settled_date', 'post_date']) || rawDate
  const descriptionRaw =
    readColumn(row, headerMap, ['description', 'details', 'memo', 'line_item']) ||
    readColumn(row, headerMap, ['merchant', 'vendor', 'counterparty']) ||
    readColumn(row, headerMap, ['reference', 'invoice_number']) ||
    'Imported line'
  const counterparty =
    readColumn(row, headerMap, ['merchant', 'vendor', 'counterparty']) ||
    descriptionRaw
  const reference = readColumn(row, headerMap, ['reference', 'invoice_number', 'document_id', 'transaction_id', 'payout_id'])
  const groupKey = readColumn(row, headerMap, ['group_key', 'batch_key', 'settlement_id', 'payout_group'])
  const amountRaw =
    readColumn(row, headerMap, ['amount', 'net_amount', 'gross_amount']) ||
    readColumn(row, headerMap, ['total', 'transaction_amount'])

  const txnDate = parseDateValue(rawDate, options.monthKey)
  const normalizedPostedDate = parseDateValue(postedDate || txnDate, options.monthKey)
  const amount = parseAmountValue(amountRaw)

  if (!txnDate || Number.isNaN(amount)) {
    return null
  }

  return {
    id: `rec_${crypto.randomUUID()}`,
    ...common,
    txnDate,
    postedDate: normalizedPostedDate || txnDate,
    amount,
    descriptionRaw,
    descriptionNorm: normalizeText(descriptionRaw),
    counterpartyNorm: normalizeText(counterparty),
    reference: normalizeText(reference),
    groupKey: safeKey(groupKey || reference, ''),
    matchStatus: 'unmatched',
    matchedRecordIds: [],
    note: readColumn(row, headerMap, ['note', 'notes']) || null,
  } satisfies NormalizedRecord
}

export async function parseImportFile(options: ParseImportOptions): Promise<ParsedImport> {
  const rows = parseCsvRows(options.text)
  if (rows.length <= 1) {
    throw new Error('No data rows found in the CSV.')
  }

  const headerMap = buildHeaderMap(rows[0])
  const batchId = `imp_${crypto.randomUUID()}`
  const hash = await hashString(options.text)
  const duplicate = options.existingImports.find((item) => item.hash === hash)

  const records = rows
    .slice(1)
    .map((row, index) =>
      parseRecordRow(row, index + 2, headerMap, {
        workspaceId: options.workspaceId,
        periodId: options.periodId,
        monthKey: options.monthKey,
        importId: batchId,
        sourceType: options.sourceType,
        projectKey: options.projectKey,
        accountKey: options.accountKey,
        defaultCurrency: options.defaultCurrency,
      }),
    )
    .filter(Boolean) as NormalizedRecord[]

  if (!records.length) {
    throw new Error('No valid records were parsed. Check that the file includes date and amount columns.')
  }

  const uploadedAt = isoNow()

  return {
    duplicateOfImportId: duplicate?.id,
    batch: {
      id: batchId,
      workspaceId: options.workspaceId,
      periodId: options.periodId,
      sourceType: options.sourceType,
      projectKey: safeKey(options.projectKey, 'general'),
      accountKey: safeKey(options.accountKey, 'unassigned'),
      fileName: options.fileName,
      storagePath: '',
      uploadedAt,
      rowCount: records.length,
      parseStatus: duplicate ? 'duplicate_skipped' : 'parsed',
      hash,
    },
    records,
  }
}

function daysBetween(a: string, b: string) {
  const first = new Date(`${a}T00:00:00Z`).getTime()
  const second = new Date(`${b}T00:00:00Z`).getTime()
  return Math.round(Math.abs(first - second) / 86_400_000)
}

function amountsAlmostMatch(anchor: NormalizedRecord, candidate: NormalizedRecord) {
  return Math.abs(Math.abs(anchor.amount) - Math.abs(candidate.amount)) <= amountVarianceTolerance
}

function candidateTypeCompatible(anchor: NormalizedRecord, candidate: NormalizedRecord) {
  if (anchor.sourceType !== 'statement') return false
  return candidate.sourceType === 'payout' || candidate.sourceType === 'supporting_csv'
}

function sharedGrouping(anchor: NormalizedRecord, candidate: NormalizedRecord) {
  return Boolean(anchor.groupKey && candidate.groupKey && anchor.groupKey === candidate.groupKey) ||
    Boolean(anchor.reference && candidate.reference && anchor.reference === candidate.reference)
}

function buildCandidateEvaluation(anchor: NormalizedRecord, candidate: NormalizedRecord): CandidateEvaluation {
  const amountDiff = Math.abs(Math.abs(anchor.amount) - Math.abs(candidate.amount))
  const exactAmount = amountDiff <= exactAmountTolerance
  const dateDistance = daysBetween(anchor.postedDate || anchor.txnDate, candidate.postedDate || candidate.txnDate)
  const groupMatch = sharedGrouping(anchor, candidate)
  const descriptionMatch =
    Boolean(anchor.counterpartyNorm && anchor.counterpartyNorm === candidate.counterpartyNorm) ||
    Boolean(anchor.descriptionNorm && candidate.descriptionNorm && (
      anchor.descriptionNorm.includes(candidate.descriptionNorm) ||
      candidate.descriptionNorm.includes(anchor.descriptionNorm)
    ))
  const signMismatch = candidate.sourceType === 'payout' &&
    Math.sign(anchor.amount) !== 0 &&
    Math.sign(candidate.amount) !== 0 &&
    Math.sign(anchor.amount) !== Math.sign(candidate.amount)

  let score = 0
  const reasons: string[] = []

  if (exactAmount) {
    score += 60
    reasons.push('exact_amount')
  } else if (amountsAlmostMatch(anchor, candidate)) {
    score += 28
    reasons.push('amount_variance')
  }

  if (dateDistance === 0) {
    score += 20
    reasons.push('same_day')
  } else if (dateDistance <= dateWindowDays) {
    score += 12
    reasons.push('date_window')
  }

  if (groupMatch) {
    score += 18
    reasons.push('shared_group_key')
  }

  if (descriptionMatch) {
    score += 16
    reasons.push('description_match')
  }

  if (anchor.projectKey === candidate.projectKey) {
    score += 6
    reasons.push('shared_project')
  }

  if (anchor.accountKey === candidate.accountKey) {
    score += 4
    reasons.push('shared_account')
  }

  if (signMismatch) {
    score -= 25
    reasons.push('sign_mismatch')
  }

  return {
    candidate,
    score,
    dateDistance,
    amountDiff,
    exactAmount,
    signMismatch,
    reasons,
  }
}

function confidenceFor(status: MatchStatus, score: number): ConfidenceBand {
  if (status === 'matched' && score >= 90) return 'high'
  if (status === 'matched' || status === 'exception') return 'medium'
  return 'low'
}

function statusExplanation(status: MatchStatus, anchor: NormalizedRecord, candidates: NormalizedRecord[]) {
  const lead = candidates[0]

  if (status === 'matched' && candidates.length > 1) {
    return `Grouped ${candidates.length} payout lines into ${anchor.descriptionRaw}.`
  }

  if (status === 'matched' && lead) {
    return `Matched ${anchor.descriptionRaw} to ${lead.descriptionRaw} using exact amount and timing.`
  }

  if (status === 'ambiguous') {
    return `Multiple candidates are close enough to ${anchor.descriptionRaw}; review before auto-linking.`
  }

  if (status === 'exception' && lead) {
    return `Closest candidate for ${anchor.descriptionRaw} still carries a material variance.`
  }

  return `No compatible supporting record was found for ${anchor.descriptionRaw}.`
}

function setRecordMatchState(
  recordsById: Map<string, NormalizedRecord>,
  recordIds: string[],
  status: MatchStatus,
) {
  recordIds.forEach((recordId) => {
    const record = recordsById.get(recordId)
    if (!record) return

    record.matchStatus = status
    record.matchedRecordIds = recordIds.filter((id) => id !== recordId)
  })
}

function createMatchRecord(
  workspaceId: string,
  periodId: string,
  matchType: MatchType,
  recordIds: string[],
  status: MatchStatus,
  score: number,
  reasonCodes: string[],
  explanation: string,
  varianceAmount: number,
  provenance: MatchProvenance = 'engine',
  overrideId: string | null = null,
  metadata: Partial<Pick<MatchResultRecord, 'id' | 'createdAt' | 'updatedAt'>> = {},
): MatchResultRecord {
  const now = isoNow()

  return {
    id: metadata.id ?? `match_${crypto.randomUUID()}`,
    workspaceId,
    periodId,
    matchType,
    recordIds,
    status,
    score,
    confidenceBand: confidenceFor(status, score),
    reasonCodes,
    explanation,
    varianceAmount,
    provenance,
    overrideId,
    createdAt: metadata.createdAt ?? now,
    updatedAt: metadata.updatedAt ?? now,
  }
}

export function reconcileRecords(records: NormalizedRecord[]) {
  const clonedRecords = records.map((record) => ({
    ...record,
    matchStatus: 'unmatched' as MatchStatus,
    matchedRecordIds: [],
  }))
  const recordsById = new Map(clonedRecords.map((record) => [record.id, record]))
  const consumed = new Set<string>()
  const matches: MatchResultRecord[] = []
  const statements = clonedRecords.filter((record) => record.sourceType === 'statement')
  const supporting = clonedRecords.filter((record) => record.sourceType !== 'statement')

  const consumeMatch = (
    recordIds: string[],
    status: MatchStatus,
    matchType: MatchType,
    score: number,
    reasonCodes: string[],
    explanation: string,
    varianceAmount = 0,
  ) => {
    setRecordMatchState(recordsById, recordIds, status)
    recordIds.forEach((recordId) => consumed.add(recordId))

    const anchorId = recordIds[0]
    const anchorRecord = recordsById.get(anchorId)
    if (!anchorRecord) return

    matches.push(
      createMatchRecord(
        anchorRecord.workspaceId,
        anchorRecord.periodId,
        matchType,
        recordIds,
        status,
        score,
        reasonCodes,
        explanation,
        varianceAmount,
      ),
    )
  }

  for (const statement of statements) {
    if (consumed.has(statement.id)) continue

    const payoutCandidates = supporting.filter((candidate) => {
      return !consumed.has(candidate.id) &&
        candidate.sourceType === 'payout' &&
        sharedGrouping(statement, candidate)
    })

    if (payoutCandidates.length >= 2) {
      const groupSum = payoutCandidates.reduce((sum, candidate) => sum + candidate.amount, 0)
      if (Math.abs(groupSum - statement.amount) <= exactAmountTolerance) {
        const recordIds = [statement.id, ...payoutCandidates.map((candidate) => candidate.id)]
        consumeMatch(
          recordIds,
          'matched',
          'one_to_many',
          96,
          ['group_sum_exact', 'shared_group_key'],
          statusExplanation('matched', statement, payoutCandidates),
        )
      }
    }
  }

  const unusedPayouts = supporting.filter((record) => record.sourceType === 'payout' && !consumed.has(record.id))
  for (const payout of unusedPayouts) {
    const statementCandidates = statements.filter((candidate) => {
      return !consumed.has(candidate.id) &&
        sharedGrouping(payout, candidate)
    })

    if (statementCandidates.length >= 2) {
      const statementSum = statementCandidates.reduce((sum, candidate) => sum + candidate.amount, 0)
      if (Math.abs(statementSum - payout.amount) <= exactAmountTolerance) {
        const recordIds = [payout.id, ...statementCandidates.map((candidate) => candidate.id)]
        consumeMatch(
          recordIds,
          'matched',
          'many_to_one',
          94,
          ['group_sum_exact', 'shared_group_key'],
          `Matched ${statementCandidates.length} statement rows to grouped payout ${payout.descriptionRaw}.`,
        )
      }
    }
  }

  for (const statement of statements) {
    if (consumed.has(statement.id)) continue

    const evaluations = supporting
      .filter((candidate) => !consumed.has(candidate.id) && candidateTypeCompatible(statement, candidate))
      .map((candidate) => buildCandidateEvaluation(statement, candidate))
      .filter((evaluation) => evaluation.score > 0)
      .sort((left, right) => right.score - left.score)

    const exactCandidates = evaluations.filter((evaluation) => evaluation.exactAmount)

    if (exactCandidates.length) {
      const [top, runnerUp] = exactCandidates
      const margin = top.score - (runnerUp?.score ?? 0)

      if (!runnerUp || margin >= 9) {
        consumeMatch(
          [statement.id, top.candidate.id],
          'matched',
          'one_to_one',
          top.score,
          top.reasons,
          statusExplanation('matched', statement, [top.candidate]),
        )
      } else {
        const candidateIds = exactCandidates.slice(0, 3).map((evaluation) => evaluation.candidate.id)
        consumeMatch(
          [statement.id, ...candidateIds],
          'ambiguous',
          'one_to_one',
          top.score,
          [...new Set(exactCandidates.flatMap((evaluation) => evaluation.reasons).concat('close_competitor'))],
          statusExplanation('ambiguous', statement, exactCandidates.map((evaluation) => evaluation.candidate)),
        )
      }
      continue
    }

    const [bestNearCandidate] = evaluations
    if (bestNearCandidate && bestNearCandidate.score >= 40) {
      consumeMatch(
        [statement.id, bestNearCandidate.candidate.id],
        'exception',
        'one_to_one',
        bestNearCandidate.score,
        [...new Set(bestNearCandidate.reasons.concat(bestNearCandidate.signMismatch ? ['sign_mismatch'] : ['amount_variance']))],
        statusExplanation('exception', statement, [bestNearCandidate.candidate]),
        bestNearCandidate.amountDiff,
      )
      continue
    }

    consumeMatch(
      [statement.id],
      'unmatched',
      'one_to_one',
      0,
      ['no_candidate'],
      statusExplanation('unmatched', statement, []),
    )
  }

  for (const record of clonedRecords) {
    if (consumed.has(record.id)) continue

    consumeMatch(
      [record.id],
      'unmatched',
      'one_to_one',
      0,
      ['orphan_record'],
      `Imported ${sourceTypeLabel(record.sourceType).toLowerCase()} line ${record.descriptionRaw} does not have a linked statement anchor yet.`,
    )
  }

  const matchCounts = emptyMatchCounts()
  matches.forEach((match) => {
    matchCounts[match.status] += 1
  })

  return {
    records: clonedRecords,
    matches: matches.sort((left, right) => {
      const statusDelta = matchStatusOrder.indexOf(left.status) - matchStatusOrder.indexOf(right.status)
      if (statusDelta !== 0) return statusDelta
      return right.score - left.score
    }),
    matchCounts,
  }
}

function buildRecordCounts(records: NormalizedRecord[]) {
  const counts = emptySourceCounts()

  records.forEach((record) => {
    counts[record.sourceType] += 1
  })

  return {
    total: records.length,
    bySourceType: counts,
  }
}

function intersectsRecordIds(left: string[], rightSet: Set<string>) {
  return left.some((recordId) => rightSet.has(recordId))
}

function cloneRecordWithAnnotation(
  record: NormalizedRecord,
  annotationMap: Map<string, RecordAnnotation>,
): NormalizedRecord {
  const annotation = annotationMap.get(record.id)

  return {
    ...record,
    note: annotation?.note ?? record.note ?? null,
  }
}

function deriveMatchType(records: NormalizedRecord[]): MatchType {
  const statementCount = records.filter((record) => record.sourceType === 'statement').length

  if (records.length <= 2) {
    return 'one_to_one'
  }

  if (statementCount === 1) {
    return 'one_to_many'
  }

  if (statementCount >= 2) {
    return 'many_to_one'
  }

  return 'one_to_many'
}

function buildManualOverrideExplanation(
  kind: ManualMatchOverride['kind'],
  records: NormalizedRecord[],
  note: string | null,
) {
  const primaryLabel = records[0]?.descriptionRaw ?? 'selected records'
  const noteSuffix = note ? ` Note: ${note}` : ''

  if (kind === 'manual_match') {
    return `Manually matched ${records.length} record${records.length === 1 ? '' : 's'} starting with ${primaryLabel}.${noteSuffix}`.trim()
  }

  return `Manually reopened ${records.length} record${records.length === 1 ? '' : 's'} for review starting with ${primaryLabel}.${noteSuffix}`.trim()
}

function resolveManualOverrides(manualOverrides: ManualMatchOverride[]) {
  const activeOverrides: ManualMatchOverride[] = []

  const sortedOverrides = [...manualOverrides].sort((left, right) => {
    return left.updatedAt.localeCompare(right.updatedAt) || left.createdAt.localeCompare(right.createdAt)
  })

  sortedOverrides.forEach((override) => {
    const overrideRecordIds = new Set(override.recordIds)

    const nextActive = activeOverrides.filter((existing) => {
      return !existing.recordIds.some((recordId) => overrideRecordIds.has(recordId))
    })

    nextActive.push({
      ...override,
      note: override.note ?? null,
      recordIds: uniqueValues(override.recordIds),
    })

    activeOverrides.splice(0, activeOverrides.length, ...nextActive)
  })

  return activeOverrides
}

export function buildEffectivePeriodBundle(periodBundle: PeriodBundle): PeriodBundle {
  const annotationMap = new Map(
    (periodBundle.annotations ?? []).map((annotation) => [annotation.recordId, annotation]),
  )
  const records = periodBundle.records.map((record) => cloneRecordWithAnnotation(record, annotationMap))
  const recordMap = new Map(records.map((record) => [record.id, record]))
  const baseMatches: MatchResultRecord[] = (periodBundle.matches ?? []).map((match) => ({
    ...match,
    provenance: match.provenance ?? 'engine',
    overrideId: match.overrideId ?? null,
  }))
  const resolvedOverrides = resolveManualOverrides(periodBundle.manualOverrides ?? [])
  const suppressedRecordIds = new Set(resolvedOverrides.flatMap((override) => override.recordIds))

  const effectiveMatches: MatchResultRecord[] = baseMatches.filter((match) => !intersectsRecordIds(match.recordIds, suppressedRecordIds))

  resolvedOverrides.forEach((override) => {
    const relatedRecords = override.recordIds
      .map((recordId) => recordMap.get(recordId))
      .filter(Boolean) as NormalizedRecord[]

    if (!relatedRecords.length) {
      return
    }

    effectiveMatches.push(
      createMatchRecord(
        relatedRecords[0].workspaceId,
        relatedRecords[0].periodId,
        deriveMatchType(relatedRecords),
        relatedRecords.map((record) => record.id),
        override.kind === 'manual_match' ? 'matched' : 'ambiguous',
        override.kind === 'manual_match' ? 100 : 78,
        [override.kind, 'manual_override'],
        buildManualOverrideExplanation(override.kind, relatedRecords, override.note),
        0,
        override.kind,
        override.id,
        {
          id: `match_override_${override.id}`,
          createdAt: override.createdAt,
          updatedAt: override.updatedAt,
        },
      ),
    )
  })

  const resetRecords = records.map((record) => ({
    ...record,
    matchStatus: 'unmatched' as MatchStatus,
    matchedRecordIds: [],
  }))
  const resetRecordMap = new Map(resetRecords.map((record) => [record.id, record]))

  effectiveMatches.forEach((match) => {
    setRecordMatchState(resetRecordMap, match.recordIds, match.status)
  })

  const matchCounts = emptyMatchCounts()
  effectiveMatches.forEach((match) => {
    matchCounts[match.status] += 1
  })

  return {
    period: {
      ...periodBundle.period,
      recordCounts: buildRecordCounts(resetRecords),
      matchCounts,
      status: resetRecords.length ? 'ready_for_review' : 'draft',
    },
    imports: [...periodBundle.imports].sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt)),
    records: resetRecords,
    matches: effectiveMatches.sort((left, right) => {
      const statusDelta = matchStatusOrder.indexOf(left.status) - matchStatusOrder.indexOf(right.status)
      if (statusDelta !== 0) return statusDelta
      return right.score - left.score
    }),
    annotations: periodBundle.annotations ?? [],
    manualOverrides: resolvedOverrides,
  }
}

export function rebuildPeriodBundle(
  period: PeriodRecord,
  imports: ImportBatchRecord[],
  records: NormalizedRecord[],
  options: {
    annotations?: RecordAnnotation[]
    manualOverrides?: ManualMatchOverride[]
  } = {},
): PeriodBundle {
  const now = isoNow()
  const reconciled = reconcileRecords(records)
  const nextPeriod: PeriodRecord = {
    ...period,
    quarterKey: quarterKeyForMonth(period.monthKey),
    recordCounts: buildRecordCounts(reconciled.records),
    matchCounts: reconciled.matchCounts,
    status: reconciled.records.length ? 'ready_for_review' : 'draft',
    lastReconciledAt: reconciled.records.length ? now : period.lastReconciledAt,
    updatedAt: now,
  }

  return {
    period: nextPeriod,
    imports: [...imports].sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt)),
    records: reconciled.records,
    matches: reconciled.matches,
    annotations: options.annotations ?? [],
    manualOverrides: options.manualOverrides ?? [],
  }
}

export function createEmptyPeriod(workspaceId: string, monthKey: string): PeriodBundle {
  const now = isoNow()
  const period: PeriodRecord = {
    id: `period_${monthKey}`,
    workspaceId,
    monthKey,
    quarterKey: quarterKeyForMonth(monthKey),
    status: 'draft',
    recordCounts: {
      total: 0,
      bySourceType: emptySourceCounts(),
    },
    matchCounts: emptyMatchCounts(),
    createdAt: now,
    updatedAt: now,
  }

  return {
    period,
    imports: [],
    records: [],
    matches: [],
    annotations: [],
    manualOverrides: [],
  }
}

export function buildFollowUpSummary(periodBundle: PeriodBundle, currencyCode = 'USD') {
  const unresolved = periodBundle.matches.filter((match) => match.status !== 'matched')
  if (!unresolved.length) {
    return `Period ${periodBundle.period.monthKey} is fully matched.`
  }

  const lines = unresolved.map((match) => {
    const amount = resolvePrimaryAmount(match, periodBundle.records)
    const label = resolvePrimaryLabel(match, periodBundle.records)
    return `- ${matchStatusLabel(match.status)} | ${label} | ${currency(amount, currencyCode)} | ${match.explanation}`
  })

  return [
    `Follow-up queue for ${formatMonthLabel(periodBundle.period.monthKey)}:`,
    ...lines,
  ].join('\n')
}

export function resolvePrimaryRecord(match: MatchResultRecord, records: NormalizedRecord[]) {
  const recordMap = new Map(records.map((record) => [record.id, record]))

  return match.recordIds
    .map((recordId) => recordMap.get(recordId))
    .find((record) => record?.sourceType === 'statement') ??
    match.recordIds.map((recordId) => recordMap.get(recordId)).find(Boolean) ??
    null
}

export function resolvePrimaryLabel(match: MatchResultRecord, records: NormalizedRecord[]) {
  return resolvePrimaryRecord(match, records)?.descriptionRaw ?? 'Imported record'
}

export function resolvePrimaryAmount(match: MatchResultRecord, records: NormalizedRecord[]) {
  return resolvePrimaryRecord(match, records)?.amount ?? 0
}

export function uniqueValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right))
}

export function monthInputValue() {
  return new Date().toISOString().slice(0, 7)
}
