import { useMemo } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { currency } from '@/utils'
import { WorkspaceChecklistState } from './workspace-empty-states'
import { useWorkspace } from './workspace-context'
import { MatchBadge } from './workspace-shared'
import { buildQueueRows } from './workspace-utils'

export default function FollowUpPage() {
  const {
    buildCurrentPath,
    currentPeriodBundle,
    currentWorkspace,
    followUpSummary,
    handleExportFollowUp,
    handleLoadSampleSnapshot,
    setShowNewPeriodForm,
    stats,
    userSignedIn,
  } = useWorkspace()
  const reviewPath = buildCurrentPath('queue')
  const importPath = buildCurrentPath('imports')
  const unresolvedRows = useMemo(() => {
    return buildQueueRows(currentPeriodBundle).filter((row) => row.match.status !== 'matched')
  }, [currentPeriodBundle])
  const unresolvedCount = unresolvedRows.length
  const hasMonthData = Boolean(currentPeriodBundle?.records.length)

  if (!hasMonthData) {
    return (
      <WorkspaceChecklistState
        eyebrow="Nothing to send yet"
        title="Bring in files before you prepare follow-up."
        description="This page stays focused on the items that are still open after review. Once files are in, the follow-up list will fill in automatically."
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
            body: 'Upload the statement, payout export, or support file you are using for this close month.',
          },
          {
            title: 'Review what is still open',
            body: 'The review page will show the transactions that still need support, a cleaner match, or another check.',
          },
          {
            title: 'Export only the open items',
            body: 'When you are ready, this page turns those open items into a clean follow-up list.',
          },
        ]}
      />
    )
  }

  if (unresolvedCount === 0) {
    return (
      <WorkspaceChecklistState
        eyebrow="Nothing to send yet"
        title="This month is clear for now."
        description="There are no open follow-up items at the moment. If something changes, it will appear here automatically."
        primaryAction={reviewPath ? { label: 'Back to review', href: reviewPath } : undefined}
        steps={[
          {
            title: 'Files are already in place',
            body: `${currentPeriodBundle?.imports.length ?? 0} file${currentPeriodBundle?.imports.length === 1 ? '' : 's'} are attached to this month.`,
          },
          {
            title: 'Review has no open items',
            body: 'Everything currently in the month is either ready or no longer needs follow-up.',
          },
          {
            title: 'Come back only if something reopens',
            body: 'If a transaction needs another document or a second look, it will return here automatically.',
          },
        ]}
      />
    )
  }

  return (
    <div className="overflow-hidden border border-[#dde4e1] bg-white lg:flex lg:min-h-0 lg:flex-1 lg:flex-col xl:h-full">
      <div className="flex flex-col gap-4 border-b border-[#e5ece9] px-5 py-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#617a73]">
            Follow-up
          </p>
          <h2 className="text-lg font-semibold tracking-tight text-[#102d28]">
            Open items ready to send
          </h2>
          <p className="text-sm leading-6 text-[#617a73]">
            Review the list before you send it, then export only the transactions that still need a document, clarification, or another decision.
          </p>
        </div>

        <div className="flex flex-col gap-4 xl:items-end">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[#617a73]">
            <FollowUpMetric label="Still open" value={unresolvedCount} />
            <FollowUpMetric label="Ready" value={stats?.matched ?? 0} />
            <FollowUpMetric label="Files" value={currentPeriodBundle?.imports.length ?? 0} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              className="rounded-lg bg-[#173f39] text-white hover:bg-[#0f312b]"
              onClick={handleExportFollowUp}
              disabled={!currentPeriodBundle}
            >
              Export follow-up list
            </Button>
            {reviewPath && (
              <Button asChild variant="outline" className="rounded-lg border-slate-200 bg-white">
                <Link to={reviewPath}>Back to review</Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <section className="min-w-0 xl:min-h-0 xl:overflow-y-auto">
          <div className="border-b border-[#e5ece9] px-5 py-4">
            <p className="text-sm leading-6 text-[#617a73]">
              Only the transactions that still need follow-up are included here, so the handoff stays focused and easier to explain.
            </p>
          </div>

          <div className="divide-y divide-[#e5ece9]">
            {unresolvedRows.map((row) => (
              <div key={row.id} className="space-y-3 px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium tracking-tight text-[#102d28]">
                      {row.primaryRecord?.descriptionRaw ?? 'Imported record'}
                    </p>
                    <p className="text-sm leading-6 text-[#617a73]">{row.match.explanation}</p>
                  </div>
                  <MatchBadge status={row.match.status} />
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-[#617a73]">
                  <span>{row.projectKeys.join(', ') || 'general'}</span>
                  <span>{currency(row.primaryRecord?.amount ?? 0, currentWorkspace?.workspace.defaultCurrency)}</span>
                  <span>{row.importNames[0] ?? 'Unknown file'}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-[#e5ece9] bg-[#fbfcfb] xl:flex xl:min-h-0 xl:flex-col xl:border-l xl:border-t-0">
          <div className="border-b border-[#e5ece9] px-5 py-4">
            <h3 className="text-sm font-medium tracking-tight text-[#102d28]">Follow-up draft</h3>
            <p className="mt-1 text-sm leading-6 text-[#617a73]">
              Review the text below before you export or paste it into your email thread.
            </p>
          </div>
          <ScrollArea className="xl:min-h-0 xl:flex-1">
            <div className="px-5 py-5">
              <pre className="whitespace-pre-wrap text-sm leading-6 text-foreground">{followUpSummary}</pre>
            </div>
          </ScrollArea>
        </section>
      </div>
    </div>
  )
}

function FollowUpMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="inline-flex items-baseline gap-2">
      <span className="text-[#617a73]">{label}</span>
      <span className="text-base font-semibold tracking-tight text-[#102d28] [font-variant-numeric:tabular-nums]">
        {value}
      </span>
    </div>
  )
}
