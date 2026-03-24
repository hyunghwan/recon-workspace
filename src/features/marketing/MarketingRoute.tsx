import { useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowRight, FileStack, MessageSquareMore } from 'lucide-react'
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
    <div className="min-h-screen bg-[#f4f7f6] text-foreground">
      <header className="border-b border-[#dde5e2] bg-[#f4f7f6]/95 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 py-4">
            <div className="flex items-center justify-between gap-4">
              <ReconLockup
                subtitle="Reconciliation prep for month-end close"
                markClassName="h-11 w-11"
                titleClassName="text-sm text-foreground"
                subtitleClassName="text-xs text-muted-foreground"
              />

              <div className="flex flex-wrap gap-2">
                <Button asChild variant="ghost" className="rounded-xl text-muted-foreground">
                  <a href="/blog/">Blog</a>
                </Button>
                <Button
                  variant="ghost"
                  className="rounded-xl text-muted-foreground"
                  onClick={() => void handleGoogleEntry('default')}
                  disabled={authBusy !== null}
                >
                  {user ? 'Open workspace' : 'Sign in'}
                </Button>
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

            {authMessage && <p className="text-sm text-[#5d746e]">{authMessage}</p>}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <section className="space-y-8 border-b border-[#dde5e2] pb-14 lg:space-y-10 lg:pb-16">
          <div className="max-w-3xl space-y-6">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#5f7670]">
              For bookkeepers and small finance teams
            </p>

            <div className="space-y-4">
              <h1 className="font-heading text-5xl font-semibold leading-[0.92] tracking-[-0.06em] text-[#102d28] sm:text-6xl lg:text-7xl">
                Know what still needs support before month-end close.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-[#4c6660] sm:text-lg">
                Upload the month&rsquo;s statement and support files, review the transactions that are still open, and send a clean follow-up list without rebuilding your notes in a spreadsheet.
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

          <section className="overflow-hidden rounded-[34px] border border-[#dbe4e1] bg-white">
            <div className="flex flex-col gap-3 border-b border-[#e5ece9] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#617a73]">
                  Northwind Goods / March close
                </p>
                <p className="text-sm tracking-tight text-[#102d28]">Files, review work, and follow-up stay tied to the same month.</p>
              </div>
              <div className="inline-flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-[#617a73]">
                <span>Files</span>
                <ArrowRight aria-hidden="true" className="size-3 text-[#a0b0ab]" />
                <span className="text-[#173f39]">Review</span>
                <ArrowRight aria-hidden="true" className="size-3 text-[#a0b0ab]" />
                <span>Follow-up</span>
              </div>
            </div>

            <div className="grid lg:grid-cols-[minmax(0,1.15fr)_360px]">
              <div className="min-w-0 border-b border-[#e5ece9] px-5 py-5 lg:border-b-0 lg:border-r">
                <div className="flex flex-col gap-2 border-b border-[#edf2f0] pb-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-sm font-medium tracking-tight text-[#102d28]">
                      Transactions that still need attention
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[#617a73]">
                      Start with the items that still need a document, a cleaner match, or one more decision before close.
                    </p>
                  </div>
                  <p className="text-sm text-[#617a73]">3 open items</p>
                </div>

                <div className="divide-y divide-[#edf2f0]">
                  <HeroReviewRow
                    title="Delta client travel"
                    detail="Two support rows were found for the same amount."
                    status="Needs review"
                    amount="$1,284.00"
                  />
                  <HeroReviewRow
                    title="ATM cash withdrawal"
                    detail="There is still not enough support attached to explain the withdrawal."
                    status="Needs support"
                    amount="$420.00"
                  />
                  <HeroReviewRow
                    title="Adobe Creative Cloud annual"
                    detail="The statement line and invoice agree, so this one is already covered."
                    status="Ready to file"
                    amount="$659.88"
                  />
                </div>

                <div className="grid gap-6 border-t border-[#edf2f0] pt-5 sm:grid-cols-2">
                  <div className="space-y-3">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#617a73]">
                      Files in this month
                    </p>
                    <div className="space-y-2 text-sm text-[#4c6660]">
                      <CanvasFileRow title="March operating statement.csv" meta="Statement · 4,311 rows" />
                      <CanvasFileRow title="Stripe payouts March.csv" meta="Payout export · 961 rows" />
                      <CanvasFileRow title="Travel support March.csv" meta="Supporting file · 52 rows" />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#617a73]">
                      Ready for handoff
                    </p>
                    <p className="text-sm leading-6 text-[#4c6660]">
                      When you are done reviewing, export only the open items instead of forwarding the whole statement and a separate notes sheet.
                    </p>
                  </div>
                </div>
              </div>

              <aside className="bg-[#fafcfb] px-5 py-5">
                <div className="space-y-5">
                  <div className="space-y-2">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#617a73]">
                      Selected item
                    </p>
                    <h2 className="font-heading text-3xl font-semibold tracking-[-0.05em] text-[#102d28]">
                      Delta client travel
                    </h2>
                    <p className="text-sm leading-6 text-[#4c6660]">
                      Two support rows were found, so this still needs a person to confirm which document belongs with the charge.
                    </p>
                  </div>

                  <div className="space-y-4 border-t border-[#e5ece9] pt-4">
                    <CanvasNote
                      title="Why it is open"
                      body="The amount lines up with more than one support record, so the month still needs a final decision before close."
                    />
                    <CanvasNote
                      title="Next step"
                      body="Review the duplicate support and keep only the document you want to file with the transaction."
                    />
                    <CanvasNote
                      title="Follow-up if it stays open"
                      body="If no receipt is confirmed, this item remains on the follow-up list for the client or teammate."
                    />
                  </div>
                </div>
              </aside>
            </div>
          </section>
        </section>

        <section className="grid gap-8 border-b border-[#dde5e2] py-14 lg:grid-cols-[220px_minmax(0,1fr)]">
          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#5f7670]">How it works</p>
            <p className="text-sm leading-6 text-[#617a73]">
              One month, three steps, and one list of what still needs attention.
            </p>
          </div>

          <div className="divide-y divide-[#dde5e2]">
            <WorkflowLine
              number="01"
              title="Bring in the files for the month"
              body="Upload the statement, payout export, and supporting files for the close month you are working on."
            />
            <WorkflowLine
              number="02"
              title="Work through what is still open"
              body="See which transactions still need a receipt, a clearer match, or a second look before close."
            />
            <WorkflowLine
              number="03"
              title="Send follow-up without extra cleanup"
              body="Export a clean list of the open items instead of copying notes out of a spreadsheet."
            />
          </div>
        </section>

        <section className="grid gap-10 border-b border-[#dde5e2] py-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="space-y-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#5f7670]">
              Built around the messy part of close
            </p>
            <h2 className="font-heading text-4xl font-semibold tracking-[-0.05em] text-[#102d28]">
              Keep the files, review work, and follow-up list in one place.
            </h2>
            <p className="text-base leading-7 text-[#4c6660]">
              You do not need a dashboard full of summary cards to get through month-end. You need one surface that shows the month, the files that came in, and what still needs a document or a decision.
            </p>
            <div className="space-y-4 border-t border-[#dde5e2] pt-4">
              <DetailLine
                icon={<FileStack aria-hidden="true" className="size-4 text-[#173f39]" />}
                title="Files stay attached to the month you are reviewing"
                body="Statements, payout exports, and support files all stay with the same close month so the work still makes sense later."
              />
              <DetailLine
                icon={<MessageSquareMore aria-hidden="true" className="size-4 text-[#173f39]" />}
                title="The follow-up list is easier to explain"
                body="You can point to the exact transactions that still need support instead of sending someone back through the entire statement."
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-[30px] border border-[#dbe4e1] bg-white">
            <div className="grid gap-0 lg:grid-cols-[220px_minmax(0,1fr)]">
              <div className="border-b border-[#e5ece9] bg-[#fafcfb] px-5 py-5 lg:border-b-0 lg:border-r">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#617a73]">
                  March review
                </p>
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
                  body="The open items stay visible in the middle of the workspace, with the selected transaction and next step on the right."
                />
                <CanvasSection
                  title="Follow-up"
                  body="When the review is done, the unresolved items turn into a clean handoff list without extra cleanup."
                />
              </div>
            </div>
          </div>
        </section>

        <section className="py-14">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#5f7670]">
                Start fast after sign-in
              </p>
              <h2 className="font-heading text-4xl font-semibold tracking-[-0.05em] text-[#102d28]">
                Sign in, see the workflow once, then replace it with your own data.
              </h2>
              <p className="max-w-2xl text-base leading-7 text-[#4c6660]">
                New accounts open with a sample month inside the workspace so the value is obvious right away. Delete the sample data when you are ready and upload the files for your own client.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                size="lg"
                className="rounded-xl bg-[#173f39] text-white hover:bg-[#0f312b]"
                onClick={() => void handleGoogleEntry('default')}
                disabled={authBusy !== null}
              >
                {user ? 'Open workspace' : 'Sign in with Google'}
                <ArrowRight />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="rounded-xl border-[#d6dfdc] bg-white"
                onClick={() => void handleGoogleEntry('default')}
                disabled={authBusy !== null}
              >
                Sign in with Google
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

function HeroReviewRow({
  title,
  detail,
  status,
  amount,
}: {
  title: string
  detail: string
  status: string
  amount: string
}) {
  return (
    <div className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium tracking-tight text-[#102d28]">{title}</p>
          <StatusLabel status={status} />
        </div>
        <p className="text-sm leading-6 text-[#617a73]">{detail}</p>
      </div>
      <p className="text-sm font-medium tracking-tight text-[#173f39]">{amount}</p>
    </div>
  )
}

function StatusLabel({ status }: { status: string }) {
  const className =
    status === 'Needs support'
      ? 'border-[#ead7b8] bg-[#fbf7ee] text-[#7b5a1e]'
      : status === 'Needs review'
        ? 'border-[#dbe5e1] bg-[#f7faf9] text-[#173f39]'
        : 'border-[#cfe2d8] bg-[#f4f9f6] text-[#2f675d]'

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${className}`}>
      {status}
    </span>
  )
}

function CanvasFileRow({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="border-b border-[#edf2f0] pb-2 last:border-b-0 last:pb-0">
      <p className="text-sm font-medium tracking-tight text-[#102d28]">{title}</p>
      <p className="mt-1 text-sm text-[#617a73]">{meta}</p>
    </div>
  )
}

function CanvasNote({ title, body }: { title: string; body: string }) {
  return (
    <div className="space-y-2 border-b border-[#e5ece9] pb-4 last:border-b-0 last:pb-0">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#617a73]">{title}</p>
      <p className="text-sm leading-6 text-[#4c6660]">{body}</p>
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
    <div className="grid gap-4 py-5 sm:grid-cols-[72px_minmax(0,1fr)] sm:items-start">
      <p className="text-sm font-medium tracking-[0.14em] text-[#617a73]">{number}</p>
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
      <p className="text-sm font-medium tracking-tight text-[#102d28]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[#617a73]">{body}</p>
    </div>
  )
}
