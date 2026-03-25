import { useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowRight, CheckCircle2, FileStack, ListChecks, MessageSquareMore } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import {
  beginGoogleSignIn,
  describeAuthError,
  prepareAppDestination,
  type GoogleSignInMode,
} from '@/auth'
import { useAuthSession } from '@/auth/auth-session'
import { ReconLockup } from '@/components/brand/ReconBrand'
import { Button } from '@/components/ui/button'

const heroMetrics = [
  {
    label: 'One workspace',
    body: 'Files, review, and follow-up stay on the same close.',
  },
  {
    label: 'Open items first',
    body: 'The queue starts with what still needs action.',
  },
]

const workflowSteps = [
  {
    number: '01',
    title: 'Bring in the files for the month',
    body: 'Upload the statement, payout export, and supporting files for the close month you are working on.',
  },
  {
    number: '02',
    title: 'Work the transactions that are still open',
    body: 'Start from the items that still need support, a match, or a second look before close.',
  },
  {
    number: '03',
    title: 'Export a clean follow-up list',
    body: 'Share only the unresolved items instead of rebuilding notes in a spreadsheet or email thread.',
  },
]

const valuePoints = [
  {
    icon: <FileStack aria-hidden="true" className="size-4 text-[#173f39]" />,
    title: 'Files stay attached to the month',
    body: 'Statements, payout exports, and supporting files remain tied to the close period they belong to.',
  },
  {
    icon: <ListChecks aria-hidden="true" className="size-4 text-[#173f39]" />,
    title: 'Review stays focused on what needs action',
    body: 'The queue keeps attention on missing support, review decisions, and items that are ready to file.',
  },
  {
    icon: <MessageSquareMore aria-hidden="true" className="size-4 text-[#173f39]" />,
    title: 'Follow-up is easier to explain',
    body: 'When the month is done, the unresolved items are already gathered into a clean handoff list.',
  },
]

export default function MarketingRoute() {
  const navigate = useNavigate()
  const { user } = useAuthSession()
  const [authBusy, setAuthBusy] = useState<GoogleSignInMode | null>(null)
  const [authMessage, setAuthMessage] = useState('')

  async function handleGoogleEntry(mode: GoogleSignInMode) {
    if (user) {
      const destination =
        mode === 'import'
          ? prepareAppDestination({ mode: 'import', returnTo: '/app' })
          : '/app'
      navigate(destination)
      return
    }

    try {
      setAuthBusy(mode)
      setAuthMessage(
        mode === 'import'
          ? 'Sign in to upload original CSV files into Firebase Storage.'
          : 'Signing in with Google...',
      )
      await beginGoogleSignIn({
        mode,
        returnTo: '/app',
      })
    } catch (error) {
      setAuthMessage(`Login issue: ${describeAuthError(error)}`)
    } finally {
      setAuthBusy(null)
    }
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f9f8_0%,#eef4f1_46%,#f7f9f7_100%)] text-foreground">
      <header className="border-b border-[#dde5e2] bg-[#f7f9f8]/88 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <ReconLockup
            subtitle="Reconciliation prep for month-end close"
            markClassName="h-11 w-11"
            titleClassName="text-sm text-foreground"
            subtitleClassName="text-xs text-muted-foreground"
          />

          <div className="flex flex-wrap gap-2">
            {!user ? (
              <Button
                variant="ghost"
                className="rounded-xl text-muted-foreground"
                onClick={() => void handleGoogleEntry('default')}
                disabled={authBusy !== null}
              >
                Sign in
              </Button>
            ) : null}
            <Button
              className="rounded-xl bg-[#173f39] text-white hover:bg-[#0f312b]"
              onClick={() => void handleGoogleEntry('default')}
              disabled={authBusy !== null}
            >
              {user ? 'Open workspace' : 'Start with Google'}
              <ArrowRight />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <section className="grid gap-10 border-b border-[#dde5e2] pb-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(380px,460px)] lg:items-start lg:gap-12">
          <div className="space-y-8">
            <div className="space-y-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#5f7670]">
                For bookkeepers and small finance teams
              </p>

              <div className="space-y-4">
                <h1 className="max-w-3xl font-heading text-5xl font-semibold leading-[0.94] tracking-[-0.06em] text-[#102d28] sm:text-6xl lg:text-[4.6rem]">
                  Know what still needs support before month-end close.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-[#4c6660] sm:text-lg">
                  Bring in the month&apos;s statement and support files, review the items that still need attention, and send a clean follow-up list without rebuilding notes in a spreadsheet.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  size="lg"
                  className="rounded-xl bg-[#173f39] px-4 text-white hover:bg-[#0f312b]"
                  onClick={() => void handleGoogleEntry('default')}
                  disabled={authBusy !== null}
                >
                  {user ? 'Open workspace' : 'Start with Google'}
                  <ArrowRight />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-xl border-[#d6dfdc] bg-white"
                  onClick={() => void handleGoogleEntry('import')}
                  disabled={authBusy !== null}
                >
                  Import a CSV
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {heroMetrics.map((item) => (
                <div
                  key={item.label}
                  className="rounded-[24px] border border-[#dbe4e1] bg-white/88 px-5 py-4 shadow-[0_20px_50px_-42px_rgba(16,45,40,0.28)]"
                >
                  <p className="text-sm font-semibold tracking-tight text-[#102d28]">{item.label}</p>
                  <p className="mt-2 text-sm leading-6 text-[#617a73]">{item.body}</p>
                </div>
              ))}
            </div>

            {authMessage ? <p className="text-sm text-[#5d746e]">{authMessage}</p> : null}
          </div>

          <div className="min-w-0">
            <section className="relative overflow-hidden rounded-[32px] border border-[#dbe4e1] bg-[linear-gradient(160deg,#ffffff_0%,#f3f8f5_55%,#edf4f1_100%)] px-5 py-5 shadow-[0_28px_70px_-52px_rgba(16,45,40,0.28)] sm:px-6 sm:py-6">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(23,63,57,0.08),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(23,63,57,0.12),transparent_34%)]" />

              <div className="relative space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#617a73]">
                      March close rhythm
                    </p>
                    <p className="text-sm tracking-tight text-[#102d28]">From incoming files to a clean handoff.</p>
                  </div>
                  <div className="inline-flex items-center gap-1 rounded-full border border-[#dbe5e1] bg-white/80 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-[#173f39]">
                    Live queue
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-[minmax(0,1.05fr)_minmax(160px,0.72fr)]">
                  <div className="space-y-3 rounded-[24px] border border-[#dbe5e1] bg-white/82 p-4 backdrop-blur-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#617a73]">
                          Open items
                        </p>
                        <p className="text-sm font-medium tracking-tight text-[#102d28]">What still needs attention</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-semibold tracking-tight text-[#102d28] [font-variant-numeric:tabular-nums]">2</p>
                        <p className="text-[11px] uppercase tracking-[0.16em] text-[#617a73]">active</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <AbstractQueueRow title="Travel support" tone="review" widthClassName="w-[74%]" />
                      <AbstractQueueRow title="Cash withdrawal" tone="support" widthClassName="w-[63%]" />
                      <AbstractQueueRow title="Adobe annual" tone="ready" widthClassName="w-[56%]" />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-[24px] border border-[#dbe5e1] bg-[#173f39] p-4 text-white shadow-[0_20px_44px_-32px_rgba(16,45,40,0.55)]">
                      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/70">Current step</p>
                      <p className="mt-2 font-heading text-2xl font-semibold tracking-[-0.05em]">Review</p>
                      <p className="mt-2 text-sm leading-6 text-white/76">Decide what is ready, what still needs support, and what goes to follow-up.</p>
                    </div>

                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-[22px] border border-[#dbe5e1] bg-white/78 px-4 py-3 backdrop-blur-sm">
                  <div className="flex size-9 items-center justify-center rounded-full bg-[#edf5f1] text-[#173f39]">
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#617a73]">Outcome</p>
                    <p className="text-sm tracking-tight text-[#102d28]">The month stays organized enough to export a clear follow-up list.</p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </section>

        <section className="grid gap-8 border-b border-[#dde5e2] py-16 lg:grid-cols-[220px_minmax(0,1fr)]">
          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#5f7670]">How it works</p>
            <p className="text-sm leading-6 text-[#617a73]">
              One month, three steps, and one place to keep the close moving.
            </p>
          </div>

          <div className="divide-y divide-[#dde5e2]">
            {workflowSteps.map((step) => (
              <WorkflowLine key={step.number} number={step.number} title={step.title} body={step.body} />
            ))}
          </div>
        </section>

        <section className="grid gap-10 border-b border-[#dde5e2] py-16 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-12">
          <div className="space-y-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#5f7670]">What you get at close</p>
            <h2 className="max-w-2xl font-heading text-4xl font-semibold tracking-[-0.05em] text-[#102d28]">
              Keep the files, review work, and follow-up list in one place.
            </h2>
            <p className="max-w-2xl text-base leading-7 text-[#4c6660]">
              You do not need a dashboard full of summary cards to get through month-end. You need one surface that shows the month, the files that came in, and what still needs a document or a decision.
            </p>

            <div className="space-y-4 border-t border-[#dde5e2] pt-5">
              {valuePoints.map((item) => (
                <DetailLine key={item.title} icon={item.icon} title={item.title} body={item.body} />
              ))}
            </div>
          </div>

          <div className="rounded-[32px] border border-[#dbe4e1] bg-white shadow-[0_24px_70px_-50px_rgba(16,45,40,0.28)]">
            <div className="grid gap-0 md:grid-cols-[200px_minmax(0,1fr)]">
              <div className="border-b border-[#e5ece9] bg-[#fafcfb] px-5 py-5 md:border-b-0 md:border-r">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#617a73]">March review</p>
                <div className="mt-4 space-y-3">
                  <CanvasStatus label="Needs review" value="1" />
                  <CanvasStatus label="Needs support" value="1" />
                  <CanvasStatus label="Ready to file" value="9" />
                </div>
              </div>

              <div className="divide-y divide-[#e5ece9]">
                <CanvasSection
                  title="Files"
                  body="The month opens with the statement, payout export, and support files already lined up together."
                />
                <CanvasSection
                  title="Review"
                  body="The open items stay visible in the workspace, with the next action attached to each one."
                />
                <CanvasSection
                  title="Follow-up"
                  body="When review is done, the unresolved items turn into a clear handoff list without extra cleanup."
                />
              </div>
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="rounded-[34px] border border-[#143b35] bg-[#173f39] px-6 py-8 text-white sm:px-8 lg:flex lg:items-end lg:justify-between lg:gap-8">
            <div className="max-w-2xl space-y-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/70">
                Start the next close in one place
              </p>
              <h2 className="font-heading text-4xl font-semibold tracking-[-0.05em] text-white">
                Open the workspace, bring in the month, and work from the open items list.
              </h2>
              <p className="text-base leading-7 text-white/80">
                New accounts open fast, the workflow is ready immediately, and your own files can replace the starter data as soon as you are ready.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3 lg:mt-0">
              <Button
                size="lg"
                className="rounded-xl bg-white text-[#173f39] hover:bg-white/92"
                onClick={() => void handleGoogleEntry('default')}
                disabled={authBusy !== null}
              >
                {user ? 'Open workspace' : 'Start with Google'}
                <ArrowRight />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="rounded-xl border-white/30 bg-transparent text-white hover:bg-white/10"
                onClick={() => void handleGoogleEntry('import')}
                disabled={authBusy !== null}
              >
                Import a CSV
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

function AbstractQueueRow({
  title,
  tone,
  widthClassName,
}: {
  title: string
  tone: 'support' | 'review' | 'ready'
  widthClassName: string
}) {
  const toneClassName =
    tone === 'support'
      ? 'bg-[#fbf7ee] text-[#7b5a1e] border-[#ead7b8]'
      : tone === 'review'
        ? 'bg-[#f7faf9] text-[#173f39] border-[#dbe5e1]'
        : 'bg-[#f4f9f6] text-[#2f675d] border-[#cfe2d8]'

  return (
    <div className="rounded-[20px] border border-[#e3ebe8] bg-[#f9fbfa] p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium tracking-tight text-[#102d28]">{title}</p>
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] ${toneClassName}`}>
          {tone}
        </span>
      </div>
      <div className="mt-3 h-2 rounded-full bg-[#e7efeb]">
        <div className={`h-full rounded-full bg-[#173f39] ${widthClassName}`} />
      </div>
    </div>
  )
}


function WorkflowLine({
  number,
  title,
  body,
}: {
  number: string
  title: string
  body: string
}) {
  return (
    <div className="grid gap-4 py-6 sm:grid-cols-[72px_minmax(0,1fr)] sm:items-start">
      <p className="pt-0.5 text-sm font-medium tracking-[0.14em] text-[#617a73]">{number}</p>
      <div className="space-y-2">
        <h3 className="text-xl font-semibold tracking-tight text-[#102d28]">{title}</h3>
        <p className="max-w-2xl text-sm leading-7 text-[#4c6660]">{body}</p>
      </div>
    </div>
  )
}

function DetailLine({
  icon,
  title,
  body,
}: {
  icon: ReactNode
  title: string
  body: string
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1">{icon}</div>
      <div className="space-y-1">
        <p className="text-sm font-medium tracking-tight text-[#102d28]">{title}</p>
        <p className="text-sm leading-6 text-[#617a73]">{body}</p>
      </div>
    </div>
  )
}

function CanvasStatus({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-end justify-between border-b border-[#edf2f0] pb-3 last:border-b-0 last:pb-0">
      <p className="text-sm text-[#617a73]">{label}</p>
      <p className="text-2xl font-semibold tracking-tight text-[#102d28] [font-variant-numeric:tabular-nums]">{value}</p>
    </div>
  )
}

function CanvasSection({ title, body }: { title: string; body: string }) {
  return (
    <div className="px-5 py-5">
      <div className="inline-flex items-center gap-2">
        <CheckCircle2 aria-hidden="true" className="size-4 text-[#173f39]" />
        <p className="text-sm font-medium tracking-tight text-[#102d28]">{title}</p>
      </div>
      <p className="mt-2 text-sm leading-6 text-[#617a73]">{body}</p>
    </div>
  )
}
