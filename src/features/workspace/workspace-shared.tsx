import { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { MatchStatus, PeriodBundle, ReviewState, SourceType } from '@/types'
import {
  currency,
  matchStatusLabel,
  resolvePrimaryAmount,
  resolvePrimaryLabel,
  sourceTypeLabel,
} from '@/utils'
import type { QueueRow } from './workspace-utils'

const statusToneMap: Record<MatchStatus, string> = {
  matched: 'border-[#cfe2d8] bg-[#f4f9f6] text-[#2f675d]',
  ambiguous: 'border-[#ead7b8] bg-[#fbf7ee] text-[#7b5a1e]',
  unmatched: 'border-[#dbe3e0] bg-[#f7faf9] text-[#4f6660]',
  exception: 'border-[#ebd1d8] bg-[#fbf5f7] text-[#7d4b58]',
}

const sourceToneMap: Record<SourceType, string> = {
  statement: 'border-[#dbe3e0] bg-[#f7faf9] text-[#617a73]',
  payout: 'border-[#dbe3e0] bg-[#f7faf9] text-[#617a73]',
  supporting_csv: 'border-[#dbe3e0] bg-[#f7faf9] text-[#617a73]',
}

export function MatchBadge({ status }: { status: MatchStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn('rounded-full border px-2.5 py-1 text-[11px] font-medium', statusToneMap[status])}
    >
      {matchStatusLabel(status)}
    </Badge>
  )
}

export function SourceBadge({ sourceType }: { sourceType: SourceType }) {
  return (
    <Badge
      variant="outline"
      className={cn('rounded-full border px-2.5 py-1 text-[11px] font-medium', sourceToneMap[sourceType])}
    >
      {sourceTypeLabel(sourceType)}
    </Badge>
  )
}

export function MatchDetailPanel({
  row,
  periodBundle,
  currencyCode,
  onManualUnmatch,
  onSaveAnnotation,
}: {
  row: QueueRow | null
  periodBundle: PeriodBundle | null
  currencyCode: string
  onManualUnmatch?: (input: { note?: string; recordIds: string[] }) => Promise<void>
  onSaveAnnotation?: (input: { note: string; recordId: string; reviewState: ReviewState }) => Promise<void>
}) {
  const [annotationNote, setAnnotationNote] = useState('')
  const [reviewState, setReviewState] = useState<ReviewState>('none')
  const [saveBusy, setSaveBusy] = useState(false)
  const [reopenBusy, setReopenBusy] = useState(false)

  useEffect(() => {
    setAnnotationNote(row?.primaryAnnotation?.note ?? '')
    setReviewState(row?.primaryAnnotation?.reviewState ?? 'none')
  }, [row?.id, row?.primaryAnnotation?.note, row?.primaryAnnotation?.reviewState])

  if (!row || !periodBundle) {
    return (
      <aside className="border-t border-[#e5ece9] bg-[#fbfcfb] xl:border-l xl:border-t-0">
        <div className="space-y-3 px-5 py-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#617a73]">
            Selected transaction
          </p>
          <h2 className="text-lg font-semibold tracking-tight text-[#102d28]">Select a transaction</h2>
          <p className="text-sm leading-6 text-[#617a73]">
            Review why it is open, which files are related, and what should happen next.
          </p>
        </div>
      </aside>
    )
  }

  const importMap = new Map(periodBundle.imports.map((item) => [item.id, item]))
  const nextAction = describeNextAction(row.match.status)
  const primaryRecordId = row.primaryRecord?.id ?? row.relatedRecords[0]?.id ?? null

  return (
    <aside className="border-t border-[#e5ece9] bg-[#fbfcfb] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-right-2 motion-reduce:animate-none xl:border-l xl:border-t-0">
      <div className="space-y-6 px-5 py-5">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <MatchBadge status={row.match.status} />
            {row.matchSource !== 'engine' && (
              <span className="rounded-full border border-[#dbe3e0] bg-white px-2.5 py-1 text-[11px] text-[#617a73]">
                {row.matchSource === 'manual_match' ? 'Manual match' : 'Reopened'}
              </span>
            )}
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight text-[#102d28]">
              {resolvePrimaryLabel(row.match, periodBundle.records)}
            </h2>
            <p className="text-sm leading-6 text-[#617a73]">{row.match.explanation}</p>
          </div>
        </div>

        <section className="space-y-3 border-t border-[#e5ece9] pt-5">
          <div>
            <h3 className="text-sm font-medium tracking-tight text-[#102d28]">Why this is open</h3>
            <p className="mt-1 text-sm text-[#617a73]">
              These reasons explain why the transaction landed on the review list.
            </p>
          </div>
          <ul className="space-y-2">
            {row.match.reasonCodes.map((reasonCode) => (
              <li key={reasonCode} className="flex items-start gap-2 text-sm leading-6 text-[#4c6660]">
                <span className="mt-2 size-1.5 rounded-full bg-[#173f39]" />
                <span>{reasonCode.replaceAll('_', ' ')}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3 border-t border-[#e5ece9] pt-5">
          <div>
            <h3 className="text-sm font-medium tracking-tight text-[#102d28]">Next action</h3>
            <p className="mt-1 text-sm text-[#617a73]">
              Use this as the immediate next step before you move on to another transaction.
            </p>
          </div>
          <div className="border border-[#dde4e1] bg-white px-4 py-4">
            <p className="text-sm leading-7 text-[#173f39]">{nextAction}</p>
          </div>
          {onManualUnmatch && row.relatedRecords.length > 1 && (
            <Button
              variant="outline"
              className="rounded-lg border-[#dce4e1] bg-white"
              disabled={reopenBusy}
              onClick={async () => {
                setReopenBusy(true)
                try {
                  await onManualUnmatch({
                    note: annotationNote || undefined,
                    recordIds: row.match.recordIds,
                  })
                } finally {
                  setReopenBusy(false)
                }
              }}
            >
              {reopenBusy ? 'Reopening...' : 'Reopen this match'}
            </Button>
          )}
        </section>

        <section className="space-y-3 border-t border-[#e5ece9] pt-5">
          <div>
            <h3 className="text-sm font-medium tracking-tight text-[#102d28]">Review note</h3>
            <p className="mt-1 text-sm text-[#617a73]">
              Save the note and follow-up state that should stay with the selected record.
            </p>
          </div>
          <div className="space-y-3">
            <Select value={reviewState} onValueChange={(value) => setReviewState(value as ReviewState)}>
              <SelectTrigger className="w-full rounded-lg border-slate-200 bg-white shadow-none">
                <SelectValue placeholder="Review state" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No review state</SelectItem>
                <SelectItem value="reviewed">Reviewed</SelectItem>
                <SelectItem value="needs_follow_up">Needs follow-up</SelectItem>
              </SelectContent>
            </Select>
            <textarea
              value={annotationNote}
              onChange={(event) => setAnnotationNote(event.target.value)}
              placeholder="Add a note for the selected record..."
              rows={4}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-foreground shadow-none outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#87a59c]"
            />
            <Button
              className="rounded-lg bg-[#173f39] text-white hover:bg-[#0f312b]"
              disabled={!primaryRecordId || !onSaveAnnotation || saveBusy}
              onClick={async () => {
                if (!primaryRecordId || !onSaveAnnotation) return

                setSaveBusy(true)
                try {
                  await onSaveAnnotation({
                    note: annotationNote,
                    recordId: primaryRecordId,
                    reviewState,
                  })
                } finally {
                  setSaveBusy(false)
                }
              }}
            >
              {saveBusy ? 'Saving...' : 'Save note'}
            </Button>
          </div>
        </section>

        <section className="space-y-3 border-t border-[#e5ece9] pt-5">
          <div>
            <h3 className="text-sm font-medium tracking-tight text-[#102d28]">Related files</h3>
            <p className="mt-1 text-sm text-[#617a73]">
              You can see the original lines and which uploaded file they came from.
            </p>
          </div>
          <ScrollArea className="h-72 border border-[#dde4e1] bg-white">
            <div className="divide-y divide-[#e5ece9]">
              {row.relatedRecords.map((record) => {
                const batch = importMap.get(record.importId)

                return (
                  <div key={record.id} className="space-y-3 px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <SourceBadge sourceType={record.sourceType} />
                      <p className="text-sm font-medium text-[#102d28]">{currency(record.amount, currencyCode)}</p>
                    </div>
                    <p className="text-sm font-medium tracking-tight text-[#102d28]">{record.descriptionRaw}</p>
                    <dl className="grid gap-2 text-sm text-[#617a73]">
                      <div className="flex justify-between gap-4">
                        <dt>Date</dt>
                        <dd>{record.txnDate}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt>Project</dt>
                        <dd>{record.projectKey}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt>Account</dt>
                        <dd>{record.accountKey}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt>Reference</dt>
                        <dd>{record.reference || 'None'}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt>File</dt>
                        <dd className="text-right">{batch?.fileName ?? 'Unknown file'}</dd>
                      </div>
                    </dl>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </section>

        <section className="space-y-3 border-t border-[#e5ece9] pt-5">
          <div>
            <h3 className="text-sm font-medium tracking-tight text-[#102d28]">Technical details</h3>
            <p className="mt-1 text-sm text-[#617a73]">
              Keep these numbers nearby if you need to explain or verify the match.
            </p>
          </div>
          <div className="grid gap-px bg-[#e5ece9] sm:grid-cols-2">
            <DetailMetric label="How it was matched" value={row.match.matchType.replaceAll('_', ' ')} />
            <DetailMetric label="How sure the match is" value={row.match.confidenceBand} />
            <DetailMetric label="Match source" value={row.matchSource.replaceAll('_', ' ')} />
            <DetailMetric label="Variance" value={currency(row.match.varianceAmount, currencyCode)} />
            <DetailMetric
              label="Primary amount"
              value={currency(resolvePrimaryAmount(row.match, periodBundle.records), currencyCode)}
              className="sm:col-span-2"
            />
          </div>
        </section>
      </div>
    </aside>
  )
}

function DetailMetric({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div className={cn('bg-white px-4 py-3', className)}>
      <p className="text-[11px] text-[#617a73]">{label}</p>
      <p className="mt-2 text-sm font-medium capitalize text-[#102d28]">{value}</p>
    </div>
  )
}

function describeNextAction(status: MatchStatus) {
  if (status === 'ambiguous') {
    return 'Review the competing support or payout lines and confirm which one should stay attached to this transaction.'
  }

  if (status === 'unmatched') {
    return 'Find the missing receipt, invoice, or support file before close so this can move off the follow-up list.'
  }

  if (status === 'exception') {
    return 'Check the amount or timing difference and decide whether this needs a correction, an explanation, or another file.'
  }

  return 'This item is ready to keep on file. You can move on unless something else changes in the month.'
}
