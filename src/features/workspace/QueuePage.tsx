import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { MatchStatus, QueueView, SourceType } from '@/types'
import {
  currency,
  formatMonthLabel,
  resolvePrimaryAmount,
  sourceTypeLabel,
  sourceTypeOrder,
  uniqueValues,
} from '@/utils'
import { WorkspaceChecklistState } from './workspace-empty-states'
import { useWorkspace } from './workspace-context'
import { MatchBadge, MatchDetailPanel, SourceBadge } from './workspace-shared'
import { buildQueueRows } from './workspace-utils'

const reviewStatusOrder: MatchStatus[] = ['ambiguous', 'unmatched', 'exception', 'matched']
const reviewStatusRank = Object.fromEntries(reviewStatusOrder.map((status, index) => [status, index])) as Record<MatchStatus, number>

export default function QueuePage() {
  const {
    buildCurrentPath,
    currentPeriodBundle,
    currentWorkspace,
    handleLoadSampleSnapshot,
    handleManualMatch,
    handleManualUnmatch,
    handleSaveRecordAnnotation,
    setShowNewPeriodForm,
    userSignedIn,
  } = useWorkspace()
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedMatchIds, setSelectedMatchIds] = useState<string[]>([])
  const [manualMatchNote, setManualMatchNote] = useState('')
  const clientName = currentWorkspace?.workspace.name ?? 'this client'
  const monthName = currentPeriodBundle ? formatMonthLabel(currentPeriodBundle.period.monthKey) : 'this month'

  const importPath = buildCurrentPath('imports')
  const search = searchParams.get('q') ?? ''
  const deferredSearch = useDeferredValue(search)
  const queueView = resolveQueueView(searchParams.get('view'))
  const projectFilter = searchParams.get('project') ?? 'all'
  const accountFilter = searchParams.get('account') ?? 'all'
  const sourceFilter = resolveSourceFilter(searchParams.get('source'))
  const selectedMatchId = searchParams.get('selected') ?? ''

  const queueRows = useMemo(() => {
    return [...buildQueueRows(currentPeriodBundle)].sort((left, right) => {
      const statusDelta = reviewStatusRank[left.match.status] - reviewStatusRank[right.match.status]
      if (statusDelta !== 0) return statusDelta
      return right.match.score - left.match.score
    })
  }, [currentPeriodBundle])

  const projectOptions = useMemo(
    () => (currentPeriodBundle ? uniqueValues(currentPeriodBundle.records.map((record) => record.projectKey)) : []),
    [currentPeriodBundle],
  )
  const accountOptions = useMemo(
    () => (currentPeriodBundle ? uniqueValues(currentPeriodBundle.records.map((record) => record.accountKey)) : []),
    [currentPeriodBundle],
  )

  const filteredRows = useMemo(() => {
    return queueRows.filter((row) => {
      const queueMatches = queueView === 'all' || row.match.status === queueView
      const projectMatches = projectFilter === 'all' || row.projectKeys.includes(projectFilter)
      const accountMatches = accountFilter === 'all' || row.accountKeys.includes(accountFilter)
      const sourceMatches = sourceFilter === 'all' || row.sourceTypes.includes(sourceFilter)
      const searchMatches = !deferredSearch || row.searchText.includes(deferredSearch.toLowerCase())

      return queueMatches && projectMatches && accountMatches && sourceMatches && searchMatches
    })
  }, [accountFilter, deferredSearch, projectFilter, queueRows, queueView, sourceFilter])

  const selectedRows = useMemo(
    () => filteredRows.filter((row) => selectedMatchIds.includes(row.id)),
    [filteredRows, selectedMatchIds],
  )
  const selectedRecordIds = useMemo(() => {
    return Array.from(new Set(selectedRows.flatMap((row) => row.match.recordIds)))
  }, [selectedRows])

  const firstUnresolvedRow = filteredRows.find((row) => row.match.status !== 'matched') ?? filteredRows[0] ?? null
  const selectedRow = filteredRows.find((row) => row.id === selectedMatchId) ?? null
  const hasMonthData = Boolean(currentPeriodBundle?.records.length)

  useEffect(() => {
    if (!filteredRows.length) {
      if (selectedMatchId) {
        updateReviewParams(setSearchParams, searchParams, { selected: null }, true)
      }
      return
    }

    if (!selectedRow && firstUnresolvedRow) {
      updateReviewParams(setSearchParams, searchParams, { selected: firstUnresolvedRow.id }, true)
    }
  }, [filteredRows.length, firstUnresolvedRow, searchParams, selectedMatchId, selectedRow, setSearchParams])

  if (!hasMonthData) {
    return (
      <WorkspaceChecklistState
        eyebrow="This month is still empty"
        title="Bring in the files for this close month first."
        description={`Once you import the statement, payout export, or supporting files for ${monthName}, the review list for ${clientName} will fill in here and the follow-up page will stay in step.`}
        primaryAction={importPath ? { label: 'Bring in files', href: importPath } : undefined}
        secondaryAction={{
          label: 'Create month',
          onClick: () => setShowNewPeriodForm(true),
        }}
        tertiaryAction={
          !userSignedIn
            ? {
                label: 'Open sample month',
                onClick: handleLoadSampleSnapshot,
              }
            : undefined
        }
        steps={[
          {
            title: 'Bring in the files for the month',
            body: 'Upload the statement, payout export, or supporting file you want to review.',
          },
          {
            title: 'Review what still needs attention',
            body: 'The review list will group the items that still need a document, a clearer match, or a second look.',
          },
          {
            title: 'Send the follow-up list',
            body: 'When you are done reviewing, export only the open items instead of the entire statement.',
          },
        ]}
      />
    )
  }

  return (
    <div className="overflow-hidden border border-[#dde4e1] bg-white lg:flex-1 lg:min-h-0 xl:grid xl:h-full xl:grid-cols-[minmax(0,1.24fr)_390px]">
      <section className="min-w-0 xl:min-h-0 xl:overflow-y-auto">
        <div className="grid gap-px border-b border-[#e5ece9] bg-[#e5ece9] sm:grid-cols-2 xl:grid-cols-5">
          <SummaryMetric
            active={queueView === 'ambiguous'}
            label="Needs review"
            value={currentPeriodBundle?.period.matchCounts.ambiguous ?? 0}
            tone="ambiguous"
            onClick={() => updateReviewParams(setSearchParams, searchParams, { view: 'ambiguous', selected: null })}
          />
          <SummaryMetric
            active={queueView === 'unmatched'}
            label="Needs support"
            value={currentPeriodBundle?.period.matchCounts.unmatched ?? 0}
            tone="unmatched"
            onClick={() => updateReviewParams(setSearchParams, searchParams, { view: 'unmatched', selected: null })}
          />
          <SummaryMetric
            active={queueView === 'exception'}
            label="Needs attention"
            value={currentPeriodBundle?.period.matchCounts.exception ?? 0}
            tone="exception"
            onClick={() => updateReviewParams(setSearchParams, searchParams, { view: 'exception', selected: null })}
          />
          <SummaryMetric
            active={queueView === 'matched'}
            label="Ready"
            value={currentPeriodBundle?.period.matchCounts.matched ?? 0}
            tone="matched"
            onClick={() => updateReviewParams(setSearchParams, searchParams, { view: 'matched', selected: null })}
          />
          <button
            type="button"
            className={cn(
              'bg-white px-4 py-4 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#87a59c] focus-visible:ring-inset',
              queueView === 'all' ? 'bg-[#f7faf9] text-[#102d28]' : 'text-[#617a73] hover:bg-[#fafcfb]',
            )}
            onClick={() => updateReviewParams(setSearchParams, searchParams, { view: null, selected: null })}
          >
            <p className="text-[11px] uppercase tracking-[0.14em]">All items</p>
            <p className="mt-2 text-xl font-semibold tracking-tight [font-variant-numeric:tabular-nums]">
              {queueRows.length}
            </p>
          </button>
        </div>

        <section>
          <div className="space-y-4 border-b border-[#e5ece9] px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-1">
                <h2 className="text-base font-semibold tracking-tight text-[#102d28]">Review</h2>
                <p className="max-w-2xl text-sm leading-6 text-[#617a73]">
                  Filter {clientName} for {monthName} by project, account, file type, or search term while you work through the open items.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="ghost"
                  className="rounded-lg text-muted-foreground"
                  onClick={() =>
                    updateReviewParams(
                      setSearchParams,
                      searchParams,
                      { view: null, project: null, account: null, source: null, q: null, selected: null },
                    )
                  }
                  disabled={
                    queueView === 'all' &&
                    projectFilter === 'all' &&
                    accountFilter === 'all' &&
                    sourceFilter === 'all' &&
                    !search
                  }
                >
                  Reset filters
                </Button>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,180px))]">
              <div className="relative min-w-0">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  aria-label="Search transactions"
                  autoComplete="off"
                  name="review-search"
                  value={search}
                  onChange={(event) =>
                    updateReviewParams(setSearchParams, searchParams, {
                      q: event.target.value || null,
                      selected: null,
                    })
                  }
                  placeholder="Search transactions, project, account, file, or note..."
                  className="rounded-lg border-slate-200 bg-slate-50 pl-9 shadow-none"
                />
              </div>
              <Select
                value={projectFilter}
                onValueChange={(value) =>
                  updateReviewParams(setSearchParams, searchParams, { project: value === 'all' ? null : value, selected: null })
                }
              >
                <SelectTrigger aria-label="Filter by project" className="w-full rounded-lg border-slate-200 bg-slate-50 shadow-none">
                  <SelectValue placeholder="Project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All projects</SelectItem>
                  {projectOptions.map((projectKey) => (
                    <SelectItem key={projectKey} value={projectKey}>
                      {projectKey}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={accountFilter}
                onValueChange={(value) =>
                  updateReviewParams(setSearchParams, searchParams, { account: value === 'all' ? null : value, selected: null })
                }
              >
                <SelectTrigger aria-label="Filter by account" className="w-full rounded-lg border-slate-200 bg-slate-50 shadow-none">
                  <SelectValue placeholder="Account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All accounts</SelectItem>
                  {accountOptions.map((accountKey) => (
                    <SelectItem key={accountKey} value={accountKey}>
                      {accountKey}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={sourceFilter}
                onValueChange={(value) =>
                  updateReviewParams(setSearchParams, searchParams, { source: value === 'all' ? null : value, selected: null })
                }
              >
                <SelectTrigger aria-label="Filter by file type" className="w-full rounded-lg border-slate-200 bg-slate-50 shadow-none">
                  <SelectValue placeholder="File type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All file types</SelectItem>
                  {sourceTypeOrder.map((sourceType) => (
                    <SelectItem key={sourceType} value={sourceType}>
                      {sourceTypeLabel(sourceType)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedMatchIds.length > 0 && (
            <div className="border-b border-[#e5ece9] bg-[#f7faf9] px-4 py-4 sm:px-5">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                <div className="space-y-2">
                  <p className="text-sm font-medium tracking-tight text-[#102d28]">
                    {selectedRecordIds.length} record{selectedRecordIds.length === 1 ? '' : 's'} selected from {selectedMatchIds.length} review item{selectedMatchIds.length === 1 ? '' : 's'}
                  </p>
                  <Input
                    value={manualMatchNote}
                    onChange={(event) => setManualMatchNote(event.target.value)}
                    placeholder="Optional note for this manual match..."
                    className="rounded-lg border-slate-200 bg-white shadow-none"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    className="rounded-lg bg-[#173f39] text-white hover:bg-[#0f312b]"
                    disabled={selectedRecordIds.length < 2}
                    onClick={async () => {
                      await handleManualMatch({ note: manualMatchNote, recordIds: selectedRecordIds })
                      setSelectedMatchIds([])
                      setManualMatchNote('')
                    }}
                  >
                    Manual match
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-lg border-slate-200 bg-white"
                    onClick={() => {
                      setSelectedMatchIds([])
                      setManualMatchNote('')
                    }}
                  >
                    Clear selection
                  </Button>
                </div>
              </div>
            </div>
          )}

          {filteredRows.length === 0 ? (
            <div className="px-4 py-5 sm:px-5">
              <div className="flex flex-col gap-3 border border-dashed border-slate-200 bg-[#fafcfb] px-4 py-5 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <p>No transactions match the filters you have applied.</p>
                <Button
                  variant="outline"
                  className="rounded-lg border-slate-200 bg-white"
                  onClick={() =>
                    updateReviewParams(
                      setSearchParams,
                      searchParams,
                      { view: null, project: null, account: null, source: null, q: null, selected: null },
                    )
                  }
                >
                  Reset filters
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-200">
                      <TableHead className="w-12 px-4">Pick</TableHead>
                      <TableHead>Transaction</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sources</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead className="pr-4 text-right">Files</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.map((row) => {
                      const isSelected = row.id === selectedRow?.id
                      const isPicked = selectedMatchIds.includes(row.id)

                      return (
                        <TableRow
                          key={row.id}
                          data-state={isSelected ? 'selected' : undefined}
                          className={cn(
                            'border-slate-200/90 transition-colors duration-150 hover:bg-slate-50/70',
                            isSelected && 'bg-[#f5faf8]',
                          )}
                        >
                          <TableCell className="px-4">
                            <input
                              type="checkbox"
                              checked={isPicked}
                              onChange={(event) => {
                                setSelectedMatchIds((current) => {
                                  if (event.target.checked) {
                                    return Array.from(new Set([...current, row.id]))
                                  }

                                  return current.filter((item) => item !== row.id)
                                })
                              }}
                              aria-label={`Select ${row.primaryRecord?.descriptionRaw ?? 'Imported record'}`}
                              className="size-4 rounded border-slate-300 text-[#173f39] focus:ring-[#87a59c]"
                            />
                          </TableCell>
                          <TableCell className="whitespace-normal">
                            <button
                              type="button"
                              className="flex w-full items-start gap-3 rounded-xl py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#87a59c]"
                              onClick={() => updateReviewParams(setSearchParams, searchParams, { selected: row.id })}
                            >
                              <span
                                className={cn(
                                  'mt-2 size-2 rounded-full bg-[#cad7d4] transition-colors',
                                  isSelected && 'bg-[#173f39]',
                                )}
                              />
                              <span className="min-w-0 space-y-1">
                                <span className="block font-medium tracking-tight text-foreground">
                                  {row.primaryRecord?.descriptionRaw ?? 'Imported record'}
                                </span>
                                <span className="block text-sm text-muted-foreground">
                                  {row.match.explanation}
                                </span>
                              </span>
                            </button>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              <MatchBadge status={row.match.status} />
                              {row.matchSource !== 'engine' && (
                                <span className="rounded-full border border-[#cad7d4] bg-[#f5f8f7] px-2.5 py-1 text-[11px] text-[#45615b]">
                                  {row.matchSource === 'manual_match' ? 'Manual match' : 'Reopened'}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-normal">
                            <div className="flex flex-wrap gap-2">
                              {row.sourceTypes.map((sourceType) => (
                                <SourceBadge key={sourceType} sourceType={sourceType} />
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>{currency(resolvePrimaryAmount(row.match, currentPeriodBundle?.records ?? []), currentWorkspace?.workspace.defaultCurrency)}</TableCell>
                          <TableCell className="text-muted-foreground">{row.projectKeys.join(', ') || 'general'}</TableCell>
                          <TableCell className="pr-4 text-right text-muted-foreground [font-variant-numeric:tabular-nums]">{row.importNames.length}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="lg:hidden">
                {filteredRows.map((row) => {
                  const isSelected = row.id === selectedRow?.id
                  const isPicked = selectedMatchIds.includes(row.id)

                  return (
                    <div
                      key={row.id}
                      className={cn(
                        'border-b border-slate-200 px-4 py-4 transition-colors duration-150',
                        isSelected && 'bg-[#f7faf9]',
                      )}
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={isPicked}
                            onChange={(event) => {
                              setSelectedMatchIds((current) => {
                                if (event.target.checked) {
                                  return Array.from(new Set([...current, row.id]))
                                }

                                return current.filter((item) => item !== row.id)
                              })
                            }}
                            className="size-4 rounded border-slate-300 text-[#173f39] focus:ring-[#87a59c]"
                          />
                          Select
                        </label>
                        {row.matchSource !== 'engine' && (
                          <span className="rounded-full border border-[#cad7d4] bg-[#f5f8f7] px-2.5 py-1 text-[11px] text-[#45615b]">
                            {row.matchSource === 'manual_match' ? 'Manual match' : 'Reopened'}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#87a59c]"
                        onClick={() => updateReviewParams(setSearchParams, searchParams, { selected: row.id })}
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="text-sm font-medium tracking-tight text-foreground">
                                {row.primaryRecord?.descriptionRaw ?? 'Imported record'}
                              </p>
                              <p className="text-sm text-muted-foreground">{row.match.explanation}</p>
                            </div>
                            <MatchBadge status={row.match.status} />
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {row.sourceTypes.map((sourceType) => (
                              <SourceBadge key={sourceType} sourceType={sourceType} />
                            ))}
                          </div>
                          <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <span>{row.projectKeys.join(', ') || 'general'}</span>
                            <span>{currency(resolvePrimaryAmount(row.match, currentPeriodBundle?.records ?? []), currentWorkspace?.workspace.defaultCurrency)}</span>
                          </div>
                        </div>
                      </button>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </section>
      </section>

      <MatchDetailPanel
        row={selectedRow ?? firstUnresolvedRow}
        periodBundle={currentPeriodBundle}
        currencyCode={currentWorkspace?.workspace.defaultCurrency ?? 'USD'}
        onManualUnmatch={handleManualUnmatch}
        onSaveAnnotation={handleSaveRecordAnnotation}
      />
    </div>
  )
}

function SummaryMetric({
  active,
  label,
  value,
  tone,
  onClick,
}: {
  active: boolean
  label: string
  value: number
  tone: 'matched' | 'ambiguous' | 'unmatched' | 'exception'
  onClick: () => void
}) {
  const toneClass =
    tone === 'matched'
      ? 'text-emerald-700'
      : tone === 'ambiguous'
        ? 'text-amber-700'
        : tone === 'exception'
          ? 'text-rose-700'
          : 'text-slate-700'

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'bg-white px-4 py-4 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#87a59c] focus-visible:ring-inset',
        active ? 'bg-[#f7faf9]' : 'hover:bg-[#fafcfb]',
      )}
    >
      <p className={cn('text-[11px] uppercase tracking-[0.14em]', toneClass)}>{label}</p>
      <p className="mt-2 text-xl font-semibold tracking-tight text-[#102d28] [font-variant-numeric:tabular-nums]">
        {value}
      </p>
    </button>
  )
}

function resolveQueueView(value: string | null): QueueView {
  if (value === 'ambiguous' || value === 'unmatched' || value === 'exception' || value === 'matched') {
    return value
  }

  return 'all'
}

function resolveSourceFilter(value: string | null): 'all' | SourceType {
  if (value === 'statement' || value === 'payout' || value === 'supporting_csv') {
    return value
  }

  return 'all'
}

function updateReviewParams(
  setSearchParams: ReturnType<typeof useSearchParams>[1],
  searchParams: URLSearchParams,
  updates: Record<string, string | null>,
  replace = true,
) {
  const nextParams = new URLSearchParams(searchParams)

  Object.entries(updates).forEach(([key, value]) => {
    if (value == null || value === '' || value === 'all') {
      nextParams.delete(key)
      return
    }

    nextParams.set(key, value)
  })

  setSearchParams(nextParams, { replace })
}
