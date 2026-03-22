import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Cloud,
  Download,
  FilePlus2,
  Filter,
  LogIn,
  LogOut,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react'
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth'

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ScrollArea,
} from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { statusOrder, transactions as seedTransactions, type Status, type Transaction } from './data'
import { firebaseAuth, googleProvider, isFirebaseConfigured } from './firebase'
import { loadWorkspaceTransactions, saveWorkspaceTransactions } from './firestore'
import { loadTransactions, saveTransactions } from './storage'
import { currency, parseCsvTransactions, unresolvedSummary } from './utils'

type DraftTransaction = {
  date: string
  merchant: string
  memo: string
  amount: string
  source: string
  status: Status
  matchedDocs: string
  note: string
}

type ImportSummary = {
  imported: number
  matched: number
  unresolved: number
  missingDocs: number
  exceptions: number
}

type StatusMeta = {
  badgeClassName: string
  dotClassName: string
  label: string
  nextAction: string
}

const emptyDraft: DraftTransaction = {
  date: '',
  merchant: '',
  memo: '',
  amount: '',
  source: 'Corporate Card',
  status: 'needs review',
  matchedDocs: '0',
  note: '',
}

const statusMeta: Record<Status, StatusMeta> = {
  matched: {
    badgeClassName: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    dotClassName: 'bg-emerald-500',
    label: 'Matched',
    nextAction: 'Ready for close unless a new variance appears.',
  },
  'missing docs': {
    badgeClassName: 'border-amber-200 bg-amber-50 text-amber-700',
    dotClassName: 'bg-amber-500',
    label: 'Missing docs',
    nextAction: 'Request the receipt and business purpose, then keep it unresolved until support is attached.',
  },
  'needs review': {
    badgeClassName: 'border-sky-200 bg-sky-50 text-sky-700',
    dotClassName: 'bg-sky-500',
    label: 'Needs review',
    nextAction: 'Confirm classification and attach support before month-end close.',
  },
  exception: {
    badgeClassName: 'border-rose-200 bg-rose-50 text-rose-700',
    dotClassName: 'bg-rose-500',
    label: 'Exception',
    nextAction: 'Review the variance and confirm whether timing or missing support explains the mismatch.',
  },
  ignored: {
    badgeClassName: 'border-slate-200 bg-slate-100 text-slate-600',
    dotClassName: 'bg-slate-400',
    label: 'Ignored',
    nextAction: 'Keep this out of the unresolved queue unless it needs to be re-opened.',
  },
}

function downloadTextFile(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function buildImportSummary(parsed: Transaction[]): ImportSummary {
  const missingDocs = parsed.filter((t) => t.status === 'missing docs').length
  const exceptions = parsed.filter((t) => t.status === 'exception').length
  const unresolved = parsed.filter((t) => ['missing docs', 'needs review', 'exception'].includes(t.status)).length
  const matched = parsed.filter((t) => t.status === 'matched').length

  return {
    imported: parsed.length,
    matched,
    unresolved,
    missingDocs,
    exceptions,
  }
}

async function signInWithGoogle(
  setMessage: (message: string) => void,
) {
  if (!firebaseAuth || !googleProvider) {
    setMessage('Google sign-in is not configured yet.')
    return
  }

  const isSmallScreen = window.matchMedia('(max-width: 720px)').matches

  try {
    if (isSmallScreen) {
      await signInWithRedirect(firebaseAuth, googleProvider)
      return
    }

    await signInWithPopup(firebaseAuth, googleProvider)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Google sign-in failed'
    setMessage(`Login issue: ${message}`)
    await signInWithRedirect(firebaseAuth, googleProvider)
  }
}

function statusBadge(status: Status, className?: string) {
  return (
    <Badge
      variant="outline"
      className={cn('rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-[0.01em]', statusMeta[status].badgeClassName, className)}
    >
      {statusMeta[status].label}
    </Badge>
  )
}

function TransactionDetailPanel({
  transaction,
  onStatusChange,
  onSaveNote,
  onAddDoc,
  onDelete,
}: {
  transaction: Transaction | null
  onStatusChange: (status: Status) => void
  onSaveNote: (note: string) => void
  onAddDoc: () => void
  onDelete: () => void
}) {
  if (!transaction) {
    return (
      <Card className="border-border/70 bg-white/90 shadow-sm lg:sticky lg:top-24">
        <CardHeader>
          <Badge variant="outline" className="w-fit uppercase tracking-[0.22em] text-[10px] text-muted-foreground">
            Details
          </Badge>
          <CardTitle>Select a transaction</CardTitle>
          <CardDescription>
            Pick a visible line item to review status, save notes, and export the unresolved queue.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <TransactionDetailCard
      transaction={transaction}
      onStatusChange={onStatusChange}
      onSaveNote={onSaveNote}
      onAddDoc={onAddDoc}
      onDelete={onDelete}
    />
  )
}

function TransactionDetailCard({
  transaction,
  onStatusChange,
  onSaveNote,
  onAddDoc,
  onDelete,
}: {
  transaction: Transaction
  onStatusChange: (status: Status) => void
  onSaveNote: (note: string) => void
  onAddDoc: () => void
  onDelete: () => void
}) {
  const [noteDraft, setNoteDraft] = useState(() => transaction.note)

  return (
    <Card className="border-border/70 bg-white/90 shadow-sm lg:sticky lg:top-24">
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            {statusBadge(transaction.status)}
            <div className="space-y-1">
              <CardTitle className="text-xl tracking-tight">{transaction.merchant}</CardTitle>
              <CardDescription className="max-w-sm text-sm leading-6">
                {transaction.memo}
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[11px] text-muted-foreground">
            {transaction.source}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-border/70 bg-muted/40 p-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Date</p>
            <p className="mt-2 text-sm font-medium text-foreground">{transaction.date}</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-muted/40 p-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Amount</p>
            <p className={cn('mt-2 text-sm font-medium', transaction.amount < 0 ? 'text-rose-700' : 'text-emerald-700')}>
              {currency(transaction.amount)}
            </p>
          </div>
          <div className="rounded-xl border border-border/70 bg-muted/40 p-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Matched docs</p>
            <p className="mt-2 text-sm font-medium text-foreground">{transaction.matchedDocs}</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-muted/40 p-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Record ID</p>
            <p className="mt-2 truncate text-sm font-medium text-foreground">{transaction.id}</p>
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-medium tracking-tight">Status</h3>
            <p className="mt-1 text-sm text-muted-foreground">Use the official status set to keep follow-up work consistent.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {statusOrder.map((status) => (
              <Button
                key={status}
                type="button"
                variant={transaction.status === status ? 'secondary' : 'outline'}
                size="sm"
                className={cn(
                  'justify-start rounded-xl shadow-none',
                  transaction.status === status && statusMeta[status].badgeClassName,
                )}
                onClick={() => onStatusChange(status)}
              >
                <span className={cn('size-2 rounded-full', statusMeta[status].dotClassName)} />
                {statusMeta[status].label}
              </Button>
            ))}
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-medium tracking-tight">Reconciliation note</h3>
            <p className="mt-1 text-sm text-muted-foreground">Keep the exact next step attached to the line item.</p>
          </div>
          <Textarea
            value={noteDraft}
            onChange={(event) => setNoteDraft(event.target.value)}
            rows={4}
            className="min-h-32 rounded-xl border-border/80 bg-background shadow-none"
            placeholder="What still needs to happen?"
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="rounded-xl" onClick={() => onSaveNote(noteDraft)}>
              <Save />
              Save note
            </Button>
            <Button size="sm" variant="outline" className="rounded-xl" onClick={onAddDoc}>
              <FilePlus2 />
              Add doc
            </Button>
            <Button size="sm" variant="outline" className="rounded-xl text-rose-700 hover:text-rose-700" onClick={onDelete}>
              <Trash2 />
              Delete
            </Button>
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-medium tracking-tight">Next action</h3>
            <p className="mt-1 text-sm text-muted-foreground">Keep the queue focused on the unblocker that matters right now.</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-muted/40 p-3 text-sm leading-6 text-foreground">
            {statusMeta[transaction.status].nextAction}
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-medium tracking-tight">Activity</h3>
            <p className="mt-1 text-sm text-muted-foreground">Recent context stays attached to the record.</p>
          </div>
          <ScrollArea className="h-44 rounded-xl border border-border/70 bg-muted/30">
            <div className="space-y-3 p-3">
              {transaction.activity.map((item) => (
                <div key={item.at + item.text} className="rounded-lg border border-border/60 bg-white/80 p-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{item.at}</p>
                  <p className="mt-2 text-sm leading-6 text-foreground">{item.text}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  )
}

function LandingPage() {
  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 pb-12 pt-6 sm:px-6 lg:px-8">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_360px]">
        <Card className="relative overflow-hidden border-border/70 bg-white/90 shadow-sm">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.08),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.9),rgba(247,248,250,0.94))]" />
          <CardHeader className="relative gap-4">
            <Badge variant="outline" className="w-fit uppercase tracking-[0.24em] text-[10px] text-muted-foreground">
              Recon Workspace
            </Badge>
            <div className="space-y-4">
              <CardTitle className="max-w-3xl text-4xl leading-tight tracking-[-0.05em] sm:text-5xl">
                Turn statement exports into a short, structured queue of reconciliation work.
              </CardTitle>
              <CardDescription className="max-w-2xl text-base leading-7 text-foreground/70">
                Import a statement export, isolate missing support, and leave month-end with a clean unresolved list instead of a spreadsheet full of guesswork.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="relative flex flex-col gap-6">
            <div className="flex flex-wrap gap-3">
              <Button asChild className="rounded-xl">
                <a href="/app">
                  Open the app
                  <ArrowRight />
                </a>
              </Button>
              <Button asChild variant="outline" className="rounded-xl">
                <a href="/sample-transactions.csv" download>
                  Download sample CSV
                </a>
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border/70 bg-white/80 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Import</p>
                <p className="mt-3 text-sm font-medium tracking-tight text-foreground">Statement, card, or ops CSV</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-white/80 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Review</p>
                <p className="mt-3 text-sm font-medium tracking-tight text-foreground">Status, support, and owner notes</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-white/80 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Export</p>
                <p className="mt-3 text-sm font-medium tracking-tight text-foreground">Unresolved follow-up queue</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <div className="inline-flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-600" />
                Import statement or card CSV
              </div>
              <div className="inline-flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-600" />
                Review missing docs and exceptions
              </div>
              <div className="inline-flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-600" />
                Export the remaining follow-up list
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card className="border-border/70 bg-white/90 shadow-sm">
            <CardHeader className="gap-3">
              <Badge variant="outline" className="w-fit uppercase tracking-[0.22em] text-[10px] text-muted-foreground">
                Operator view
              </Badge>
              <CardTitle className="tracking-tight">Built for the reconciliation sprint</CardTitle>
              <CardDescription>
                Keep imports, review, and follow-up in one surface instead of spreading the month-end workflow across tabs and spreadsheets.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-xl border border-border/70 bg-muted/35 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Queue quality</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight">Unresolved first</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-xl border border-border/70 bg-white/85 p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Saved state</p>
                  <p className="mt-2 text-sm font-medium text-foreground">Local now, cloud when Firebase is ready.</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-white/85 p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Output</p>
                  <p className="mt-2 text-sm font-medium text-foreground">A short list of what still blocks close.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/70 bg-white/90 shadow-sm">
          <CardHeader>
            <Badge variant="outline" className="w-fit uppercase tracking-[0.22em] text-[10px] text-muted-foreground">
              01
            </Badge>
            <CardTitle className="tracking-tight">Import the raw export</CardTitle>
            <CardDescription>
              Bring in the bank or card CSV that represents what actually hit the books.
            </CardDescription>
          </CardHeader>
        </Card>
        <Card className="border-border/70 bg-white/90 shadow-sm">
          <CardHeader>
            <Badge variant="outline" className="w-fit uppercase tracking-[0.22em] text-[10px] text-muted-foreground">
              02
            </Badge>
            <CardTitle className="tracking-tight">Triage unresolved items</CardTitle>
            <CardDescription>
              Work through missing docs, classification issues, and payout exceptions in one queue.
            </CardDescription>
          </CardHeader>
        </Card>
        <Card className="border-border/70 bg-white/90 shadow-sm">
          <CardHeader>
            <Badge variant="outline" className="w-fit uppercase tracking-[0.22em] text-[10px] text-muted-foreground">
              03
            </Badge>
            <CardTitle className="tracking-tight">Export the follow-up list</CardTitle>
            <CardDescription>
              Hand off only the remaining blockers instead of the full statement dump.
            </CardDescription>
          </CardHeader>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="border-border/70 bg-white/90 shadow-sm">
          <CardHeader>
            <Badge variant="outline" className="w-fit uppercase tracking-[0.22em] text-[10px] text-muted-foreground">
              Built for
            </Badge>
            <CardTitle className="tracking-tight">Bookkeepers, controllers, and finance teams cleaning the messy layer before close.</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border/70 bg-muted/35 p-4 text-sm leading-6 text-foreground">
              Match statement lines to support without losing the thread on exceptions.
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/35 p-4 text-sm leading-6 text-foreground">
              Keep missing receipts, unclear transactions, and payout variances visible until they are resolved.
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-white/90 shadow-sm">
          <CardHeader>
            <Badge variant="outline" className="w-fit uppercase tracking-[0.22em] text-[10px] text-muted-foreground">
              What ships today
            </Badge>
            <CardTitle className="tracking-tight">A fast MVP surface, not another accounting platform.</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
            <p>Sample data, local persistence, CSV import, reconciliation notes, unresolved export, and Firebase-backed save scaffolding.</p>
            <p>Open the app, try the flow with sample data, and sign in once you want synced workspace state.</p>
          </CardContent>
        </Card>
      </section>

      <Card className="border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(244,246,249,0.96))] shadow-sm">
        <CardHeader className="gap-3">
          <Badge variant="outline" className="w-fit uppercase tracking-[0.22em] text-[10px] text-muted-foreground">
            Start here
          </Badge>
          <CardTitle className="max-w-3xl text-3xl tracking-[-0.04em]">
            Use the sample CSV first. Move to a signed-in workspace when you want your reconciliation state saved.
          </CardTitle>
          <CardDescription className="max-w-2xl text-base leading-7">
            The landing page stays public. The app focuses on the actual operator flow.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild className="rounded-xl">
            <a href="/app">Open the app</a>
          </Button>
          <Button asChild variant="outline" className="rounded-xl">
            <a href="/sample-transactions.csv" download>Download sample CSV</a>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}

function LoginGate() {
  const [gateMessage, setGateMessage] = useState('')

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 pb-12 pt-6 sm:px-6 lg:px-8">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_360px]">
        <Card className="border-border/70 bg-white/90 shadow-sm">
          <CardHeader className="gap-4">
            <Badge variant="outline" className="w-fit uppercase tracking-[0.24em] text-[10px] text-muted-foreground">
              Sign in required
            </Badge>
            <div className="space-y-3">
              <CardTitle className="max-w-3xl text-4xl leading-tight tracking-[-0.05em] sm:text-5xl">
                Use Google sign-in to open the reconciliation workspace.
              </CardTitle>
              <CardDescription className="max-w-2xl text-base leading-7 text-foreground/70">
                Sample CSV stays public, but the actual workspace is protected so saved work belongs to the right team and device.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button className="rounded-xl" onClick={() => signInWithGoogle(setGateMessage)}>
              <LogIn />
              Sign in with Google
            </Button>
            <Button asChild variant="outline" className="rounded-xl">
              <a href="/sample-transactions.csv" download>Download sample CSV</a>
            </Button>
          </CardContent>
          {gateMessage && (
            <CardContent className="pt-0">
              <Alert variant="destructive" className="rounded-xl border-rose-200 bg-rose-50 text-rose-700">
                <AlertCircle className="size-4" />
                <AlertTitle>Login issue</AlertTitle>
                <AlertDescription>{gateMessage}</AlertDescription>
              </Alert>
            </CardContent>
          )}
        </Card>

        <Card className="border-border/70 bg-white/90 shadow-sm">
          <CardHeader>
            <Badge variant="outline" className="w-fit uppercase tracking-[0.22em] text-[10px] text-muted-foreground">
              What happens next
            </Badge>
            <CardTitle className="tracking-tight">The same workspace flow, now behind auth.</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border border-border/70 bg-muted/35 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Import</p>
              <p className="mt-2 text-sm font-medium text-foreground">Bring in a bank, card, or ops CSV.</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/35 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Review</p>
              <p className="mt-2 text-sm font-medium text-foreground">Work missing docs, reviews, and exceptions.</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/35 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Save</p>
              <p className="mt-2 text-sm font-medium text-foreground">Keep the workspace synced once configuration is ready.</p>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}

function AppWorkspace() {
  const initial = typeof window !== 'undefined' ? loadTransactions() : null
  const [items, setItems] = useState<Transaction[]>(initial ?? seedTransactions)
  const [selectedStatus, setSelectedStatus] = useState<Status | 'all'>('all')
  const [selectedId, setSelectedId] = useState((initial ?? seedTransactions)[0]?.id ?? '')
  const [search, setSearch] = useState('')
  const [user, setUser] = useState<User | null>(null)
  const [cloudMessage, setCloudMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadingCloud, setLoadingCloud] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [draft, setDraft] = useState<DraftTransaction>(emptyDraft)
  const [lastImportSummary, setLastImportSummary] = useState<ImportSummary | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    saveTransactions(items)
  }, [items])

  useEffect(() => {
    if (!firebaseAuth) return

    getRedirectResult(firebaseAuth).catch((error) => {
      const message = error instanceof Error ? error.message : 'Unknown redirect sign-in error'
      setCloudMessage(`Login issue: ${message}`)
    })

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (nextUser) => {
      setUser(nextUser)

      if (!nextUser) return

      try {
        setLoadingCloud(true)
        const cloudItems = await loadWorkspaceTransactions(nextUser.uid)

        if (cloudItems.length) {
          setItems(cloudItems)
          setSelectedId(cloudItems[0]?.id ?? '')
          setCloudMessage(`Loaded ${cloudItems.length} transactions from cloud.`)
        } else {
          setCloudMessage('Signed in. Import a CSV or add a transaction, then save your workspace.')
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown cloud load error'
        setCloudMessage(`Cloud load error: ${message}`)
      } finally {
        setLoadingCloud(false)
      }
    })

    return () => unsubscribe()
  }, [])

  const filtered = useMemo(() => {
    return items.filter((transaction) => {
      const statusMatch = selectedStatus === 'all' || transaction.status === selectedStatus
      const searchMatch =
        !search ||
        [transaction.merchant, transaction.memo, transaction.source, transaction.note]
          .join(' ')
          .toLowerCase()
          .includes(search.toLowerCase())

      return statusMatch && searchMatch
    })
  }, [items, search, selectedStatus])

  const visibleSelectedId =
    filtered.some((transaction) => transaction.id === selectedId)
      ? selectedId
      : filtered[0]?.id ?? ''

  const selected =
    filtered.find((transaction) => transaction.id === visibleSelectedId) ?? null

  const stats = useMemo(() => {
    const unresolved = items.filter((transaction) => ['missing docs', 'needs review', 'exception'].includes(transaction.status))

    return {
      total: items.length,
      unresolved: unresolved.length,
      missingDocs: items.filter((transaction) => transaction.status === 'missing docs').length,
      exceptions: items.filter((transaction) => transaction.status === 'exception').length,
      matched: items.filter((transaction) => transaction.status === 'matched').length,
    }
  }, [items])

  const unresolvedText = unresolvedSummary(items)
  const cloudEnabled = isFirebaseConfigured
  const isEmpty = items.length === 0

  function updateSelected(patch: Partial<Transaction>) {
    if (!selected) return

    setItems((current) => current.map((transaction) => (
      transaction.id === selected.id ? { ...transaction, ...patch } : transaction
    )))
  }

  function addActivity(text: string) {
    if (!selected) return

    const stamp = new Date().toLocaleString()
    setItems((current) => current.map((transaction) => (
      transaction.id === selected.id
        ? { ...transaction, activity: [{ at: stamp, text }, ...transaction.activity] }
        : transaction
    )))
  }

  async function handleCsvUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    const text = await file.text()
    const parsed = parseCsvTransactions(text)

    if (!parsed.length) {
      setCloudMessage('No valid transactions were found in that CSV. Use columns like date, merchant, memo, amount, source, status.')
      event.target.value = ''
      return
    }

    const summary = buildImportSummary(parsed)
    setLastImportSummary(summary)
    setItems((current) => [...parsed, ...current])
    setSelectedId(parsed[0]?.id ?? '')
    setCloudMessage(`Imported ${parsed.length} transactions from CSV.`)
    event.target.value = ''
  }

  async function handleSignOut() {
    if (!firebaseAuth) return

    await signOut(firebaseAuth)
    setCloudMessage('Signed out.')
  }

  async function saveToCloud() {
    if (!isFirebaseConfigured) {
      setCloudMessage('Firebase is not configured yet. Add env vars to enable cloud save.')
      return
    }

    if (!user) {
      setCloudMessage('Please sign in with Google first.')
      return
    }

    try {
      setSaving(true)
      setCloudMessage('')
      await saveWorkspaceTransactions(user.uid, items)
      setCloudMessage(`Saved ${items.length} transactions to cloud.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown cloud save error'
      setCloudMessage(`Cloud save error: ${message}`)
    } finally {
      setSaving(false)
    }
  }

  function handleCreateTransaction() {
    if (!draft.date || !draft.merchant || !draft.amount) {
      setCloudMessage('Date, merchant, and amount are required.')
      return
    }

    const next: Transaction = {
      id: `manual_${Date.now()}`,
      date: draft.date,
      merchant: draft.merchant,
      memo: draft.memo || draft.merchant,
      amount: Number(draft.amount),
      source: draft.source || 'Manual entry',
      status: draft.status,
      matchedDocs: Number(draft.matchedDocs || 0),
      note: draft.note || 'Added manually',
      activity: [{ at: new Date().toLocaleString(), text: 'Transaction added manually' }],
    }

    setItems((current) => [next, ...current])
    setSelectedId(next.id)
    setDraft(emptyDraft)
    setShowAddForm(false)
    setCloudMessage('Transaction added.')
  }

  function handleDeleteSelected() {
    if (!selected) return

    const remaining = items.filter((transaction) => transaction.id !== selected.id)
    setItems(remaining)
    setSelectedId(remaining[0]?.id ?? '')
    setCloudMessage(remaining.length ? 'Transaction deleted.' : 'Transaction deleted. Workspace is now empty.')
  }

  const viewOptions: Array<{ value: Status | 'all'; label: string; count: number }> = [
    { value: 'all', label: 'All items', count: items.length },
    ...statusOrder.map((status) => ({
      value: status,
      label: statusMeta[status].label,
      count: items.filter((transaction) => transaction.status === status).length,
    })),
  ]

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-4 px-4 pb-12 pt-6 sm:px-6 lg:px-8">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={handleCsvUpload}
        className="hidden"
      />

      <Card className="border-border/70 bg-white/90 shadow-sm">
        <CardHeader className="gap-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <Badge variant="outline" className="w-fit uppercase tracking-[0.24em] text-[10px] text-muted-foreground">
                App
              </Badge>
              <div className="space-y-2">
                <CardTitle className="text-3xl tracking-[-0.04em] sm:text-4xl">Reconciliation workspace</CardTitle>
                <CardDescription className="max-w-3xl text-base leading-7">
                  {user
                    ? 'Signed in workspace. Import, review, and save the queue whenever you are ready.'
                    : 'Review the workflow with local data now, then sign in once you want synced workspace state.'}
                </CardDescription>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 lg:max-w-xl lg:justify-end">
              <Button variant="outline" size="sm" className="rounded-xl" onClick={() => fileInputRef.current?.click()}>
                <Upload />
                Import CSV
              </Button>
              {!user && cloudEnabled ? (
                <Button size="sm" className="rounded-xl" onClick={() => signInWithGoogle(setCloudMessage)}>
                  <LogIn />
                  Sign in with Google
                </Button>
              ) : (
                <Button size="sm" className="rounded-xl" onClick={saveToCloud} disabled={saving || !cloudEnabled}>
                  <Save />
                  {saving ? 'Saving…' : cloudEnabled ? 'Save workspace' : 'Cloud unavailable'}
                </Button>
              )}
              <Button variant="outline" size="sm" className="rounded-xl" onClick={() => downloadTextFile('unresolved-items.txt', unresolvedText)}>
                <Download />
                Export unresolved
              </Button>
              <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setShowAddForm((current) => !current)}>
                <Plus />
                {showAddForm ? 'Close form' : 'Add transaction'}
              </Button>
              <Button asChild variant="outline" size="sm" className="rounded-xl">
                <a href="/sample-transactions.csv" download>Sample CSV</a>
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-3 xl:grid-cols-[1.05fr_0.95fr]">
        <Alert className="rounded-xl border-border/70 bg-white/90 shadow-sm">
          <ShieldCheck className="size-4 text-emerald-600" />
          <AlertTitle>How to use this</AlertTitle>
          <AlertDescription>
            Import a bank or card export, work the unresolved items, and keep the note field focused on what still blocks close.
          </AlertDescription>
        </Alert>

        <Alert className="rounded-xl border-border/70 bg-white/90 shadow-sm">
          <Cloud className="size-4 text-slate-600" />
          <AlertTitle>
            {cloudEnabled
              ? user
                ? `Signed in as ${user.email ?? 'Google user'}`
                : 'Google sign-in available'
              : 'Cloud save not configured'}
          </AlertTitle>
          <AlertDescription>
            {loadingCloud
              ? 'Loading your workspace…'
              : cloudMessage ||
                (cloudEnabled
                  ? user
                    ? 'Your workspace is ready to save across devices.'
                    : 'Sign in to keep the workspace synced.'
                  : 'Cloud save will become available once the hosted environment is configured.')}
          </AlertDescription>
          {user && (
            <AlertAction>
              <Button variant="outline" size="sm" className="rounded-xl" onClick={handleSignOut}>
                <LogOut />
                Sign out
              </Button>
            </AlertAction>
          )}
        </Alert>
      </div>

      {lastImportSummary && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Card size="sm" className="border-border/70 bg-white/90 shadow-sm">
            <CardHeader>
              <CardDescription>Last import</CardDescription>
              <CardTitle className="text-2xl tracking-tight">{lastImportSummary.imported}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">transactions imported</CardContent>
          </Card>
          <Card size="sm" className="border-border/70 bg-white/90 shadow-sm">
            <CardHeader>
              <CardDescription>Need action</CardDescription>
              <CardTitle className="text-2xl tracking-tight">{lastImportSummary.unresolved}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">items still need follow-up</CardContent>
          </Card>
          <Card size="sm" className="border-border/70 bg-white/90 shadow-sm">
            <CardHeader>
              <CardDescription>Missing docs</CardDescription>
              <CardTitle className="text-2xl tracking-tight">{lastImportSummary.missingDocs}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">support requests to send</CardContent>
          </Card>
          <Card size="sm" className="border-border/70 bg-white/90 shadow-sm">
            <CardHeader>
              <CardDescription>Exceptions</CardDescription>
              <CardTitle className="text-2xl tracking-tight">{lastImportSummary.exceptions}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">variance cases to resolve</CardContent>
          </Card>
          <Card size="sm" className="border-border/70 bg-white/90 shadow-sm">
            <CardHeader>
              <CardDescription>Next move</CardDescription>
              <CardTitle className="text-lg tracking-tight">Start with blockers</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Review missing docs and exception items before exporting unresolved work.</CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card size="sm" className="border-border/70 bg-white/90 shadow-sm">
          <CardHeader>
            <CardDescription>Total</CardDescription>
            <CardTitle className="text-2xl tracking-tight">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm" className="border-border/70 bg-white/90 shadow-sm">
          <CardHeader>
            <CardDescription>Matched</CardDescription>
            <CardTitle className="text-2xl tracking-tight">{stats.matched}</CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm" className="border-border/70 bg-white/90 shadow-sm">
          <CardHeader>
            <CardDescription>Missing docs</CardDescription>
            <CardTitle className="text-2xl tracking-tight">{stats.missingDocs}</CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm" className="border-border/70 bg-white/90 shadow-sm">
          <CardHeader>
            <CardDescription>Exceptions</CardDescription>
            <CardTitle className="text-2xl tracking-tight">{stats.exceptions}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {showAddForm && (
        <Card className="border-border/70 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle className="tracking-tight">Add transaction</CardTitle>
            <CardDescription>Add a manual item when the statement export is incomplete or a follow-up needs a placeholder record.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="draft-date">Date</Label>
                <Input id="draft-date" type="date" value={draft.date} onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} className="rounded-xl shadow-none" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="draft-merchant">Merchant</Label>
                <Input id="draft-merchant" value={draft.merchant} onChange={(event) => setDraft((current) => ({ ...current, merchant: event.target.value }))} placeholder="Vendor or merchant" className="rounded-xl shadow-none" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="draft-amount">Amount</Label>
                <Input id="draft-amount" type="number" step="0.01" value={draft.amount} onChange={(event) => setDraft((current) => ({ ...current, amount: event.target.value }))} placeholder="-125.00" className="rounded-xl shadow-none" />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="draft-source">Source</Label>
                <Input id="draft-source" value={draft.source} onChange={(event) => setDraft((current) => ({ ...current, source: event.target.value }))} placeholder="Corporate Card" className="rounded-xl shadow-none" />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={draft.status} onValueChange={(value) => setDraft((current) => ({ ...current, status: value as Status }))}>
                  <SelectTrigger className="w-full rounded-xl shadow-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOrder.map((status) => (
                      <SelectItem key={status} value={status}>
                        {statusMeta[status].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="draft-memo">Memo</Label>
                <Input id="draft-memo" value={draft.memo} onChange={(event) => setDraft((current) => ({ ...current, memo: event.target.value }))} placeholder="Memo" className="rounded-xl shadow-none" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="draft-note">Note</Label>
              <Textarea id="draft-note" value={draft.note} onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))} rows={3} placeholder="What still needs to happen?" className="min-h-28 rounded-xl shadow-none" />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button className="rounded-xl" onClick={handleCreateTransaction}>
                <FilePlus2 />
                Add transaction
              </Button>
              <Button variant="outline" className="rounded-xl" onClick={() => setDraft(emptyDraft)}>
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!isEmpty && (
        <Card className="border-border/70 bg-white/90 shadow-sm lg:hidden">
          <CardHeader className="gap-4">
            <div className="space-y-1">
              <CardTitle className="tracking-tight">Browse the queue</CardTitle>
              <CardDescription>{filtered.length} visible items</CardDescription>
            </div>
            <div className="grid gap-3">
              <div className="space-y-2">
                <Label>Status filter</Label>
                <Select value={selectedStatus} onValueChange={(value) => setSelectedStatus(value as Status | 'all')}>
                  <SelectTrigger className="w-full rounded-xl shadow-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {viewOptions.map((view) => (
                      <SelectItem key={view.value} value={view.value}>
                        {view.label} ({view.count})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobile-search">Search</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="mobile-search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Merchant, memo, source, or note"
                    className="rounded-xl pl-9 shadow-none"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>
      )}

      {isEmpty ? (
        <Card className="border-border/70 bg-white/90 shadow-sm">
          <CardHeader className="items-start gap-4 text-left">
            <Badge variant="outline" className="w-fit uppercase tracking-[0.22em] text-[10px] text-muted-foreground">
              Empty workspace
            </Badge>
            <div className="space-y-2">
              <CardTitle className="text-3xl tracking-[-0.04em]">No transactions yet</CardTitle>
              <CardDescription className="max-w-2xl text-base leading-7">
                Start with the sample CSV or import a statement export to see unresolved reconciliation work immediately.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild variant="outline" className="rounded-xl">
              <a href="/sample-transactions.csv" download>Download sample CSV</a>
            </Button>
            <Button className="rounded-xl" onClick={() => fileInputRef.current?.click()}>
              <Upload />
              Import CSV
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={() => setShowAddForm(true)}>
              <Plus />
              Add first transaction
            </Button>
          </CardContent>
        </Card>
      ) : (
        <section className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_320px]">
          <Card className="hidden border-border/70 bg-white/90 shadow-sm lg:block lg:sticky lg:top-24 lg:h-fit">
            <CardHeader className="gap-4">
              <div className="space-y-1">
                <CardTitle className="text-base tracking-tight">Views</CardTitle>
                <CardDescription>Prioritize the items that still block close.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              {viewOptions.map((view) => {
                const active = selectedStatus === view.value

                return (
                  <Button
                    key={view.value}
                    variant={active ? 'secondary' : 'ghost'}
                    size="sm"
                    className={cn(
                      'w-full justify-between rounded-xl px-3 shadow-none',
                      active && 'bg-muted text-foreground',
                    )}
                    onClick={() => setSelectedStatus(view.value)}
                  >
                    <span className="inline-flex items-center gap-2">
                      {view.value !== 'all' && (
                        <span className={cn('size-2 rounded-full', statusMeta[view.value].dotClassName)} />
                      )}
                      {view.label}
                    </span>
                    <span className="text-muted-foreground">{view.count}</span>
                  </Button>
                )
              })}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-white/90 shadow-sm">
            <CardHeader className="gap-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                  <CardTitle className="tracking-tight">Transactions</CardTitle>
                  <CardDescription>{filtered.length} visible line items</CardDescription>
                </div>
                <div className="hidden w-full max-w-sm lg:block">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search merchant, memo, source, or note"
                      className="rounded-xl pl-9 shadow-none"
                    />
                    <Filter className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-0">
              {filtered.length === 0 ? (
                <div className="px-4 pb-4">
                  <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                    No transactions match the current filters. Try a different status or clear the search query.
                  </div>
                </div>
              ) : (
                <>
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="px-4">Date</TableHead>
                          <TableHead>Transaction</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="pr-4 text-right">Docs</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((transaction) => (
                          <TableRow
                            key={transaction.id}
                            data-state={transaction.id === visibleSelectedId ? 'selected' : undefined}
                            className="cursor-pointer"
                            onClick={() => setSelectedId(transaction.id)}
                          >
                            <TableCell className="px-4 text-muted-foreground">{transaction.date}</TableCell>
                            <TableCell className="whitespace-normal">
                              <div className="space-y-1">
                                <p className="font-medium tracking-tight text-foreground">{transaction.merchant}</p>
                                <p className="text-sm text-muted-foreground">{transaction.memo}</p>
                              </div>
                            </TableCell>
                            <TableCell className={cn(transaction.amount < 0 ? 'text-rose-700' : 'text-emerald-700')}>
                              {currency(transaction.amount)}
                            </TableCell>
                            <TableCell>{statusBadge(transaction.status)}</TableCell>
                            <TableCell className="pr-4 text-right text-muted-foreground">{transaction.matchedDocs}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="grid gap-3 px-4 pb-4 md:hidden">
                    {filtered.map((transaction) => (
                      <Card
                        key={transaction.id}
                        size="sm"
                        role="button"
                        tabIndex={0}
                        className={cn(
                          'cursor-pointer border-border/70 bg-white shadow-none outline-none transition hover:bg-muted/20',
                          transaction.id === visibleSelectedId && 'ring-2 ring-slate-900/10',
                        )}
                        onClick={() => setSelectedId(transaction.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            setSelectedId(transaction.id)
                          }
                        }}
                      >
                        <CardContent className="grid gap-3 pt-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="text-sm font-medium tracking-tight text-foreground">{transaction.merchant}</p>
                              <p className="text-sm text-muted-foreground">{transaction.memo}</p>
                            </div>
                            {statusBadge(transaction.status)}
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{transaction.date}</span>
                            <span className={cn('font-medium', transaction.amount < 0 ? 'text-rose-700' : 'text-emerald-700')}>
                              {currency(transaction.amount)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <span>{transaction.source}</span>
                            <span>{transaction.matchedDocs} docs</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <TransactionDetailPanel
            key={selected?.id ?? 'empty'}
            transaction={selected}
            onStatusChange={(status) => {
              updateSelected({ status })
              addActivity(`Changed status to ${status}`)
            }}
            onSaveNote={(note) => {
              updateSelected({ note })
              addActivity('Updated reconciliation note')
              setCloudMessage('Note saved locally.')
            }}
            onAddDoc={() => {
              if (!selected) return
              updateSelected({ matchedDocs: selected.matchedDocs + 1 })
              addActivity('Attached one supporting document')
            }}
            onDelete={handleDeleteSelected}
          />
        </section>
      )}
    </main>
  )
}

function App() {
  const [path, setPath] = useState(
    typeof window !== 'undefined' ? window.location.pathname : '/',
  )
  const [{ user, ready }, setAuthState] = useState<{ user: User | null; ready: boolean }>({
    user: null,
    ready: !firebaseAuth,
  })
  const isAppRoute = path === '/app'

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname)

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    if (!firebaseAuth) return

    const unsubscribe = onAuthStateChanged(firebaseAuth, (nextUser) => {
      setAuthState({ user: nextUser, ready: true })

      if (nextUser && window.location.pathname !== '/app') {
        window.location.replace('/app')
      }
    })

    return () => unsubscribe()
  }, [])

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fbfcfd_0%,#f4f6f9_100%)]">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.04),transparent_55%)]" />

      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <a href={user ? '/app' : '/'} className="inline-flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl border border-border/70 bg-white text-sm font-semibold tracking-tight text-foreground shadow-sm">
                R
              </div>
              <div>
                <p className="text-sm font-medium tracking-tight text-foreground">Recon Workspace</p>
                <p className="text-xs text-muted-foreground">Reconciliation prep for the messy layer before close</p>
              </div>
            </a>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!user && (
              <Button asChild variant={isAppRoute ? 'outline' : 'secondary'} size="sm" className="rounded-xl">
                <a href="/">Overview</a>
              </Button>
            )}
            <Button asChild variant={isAppRoute ? 'secondary' : 'outline'} size="sm" className="rounded-xl">
              <a href="/app">App</a>
            </Button>
            <Separator orientation="vertical" className="hidden h-6 md:block" />
            <Button asChild variant="outline" size="sm" className="rounded-xl">
              <a href="/sample-transactions.csv" download>Sample CSV</a>
            </Button>
            {!user && (
              <Button asChild size="sm" className="rounded-xl">
                <a href="/app">Open app</a>
              </Button>
            )}
          </div>
        </div>
      </header>

      {!ready ? (
        <main className="mx-auto max-w-7xl px-4 pb-12 pt-8 sm:px-6 lg:px-8">
          <Card className="border-border/70 bg-white/90 shadow-sm">
            <CardHeader>
              <Badge variant="outline" className="w-fit uppercase tracking-[0.22em] text-[10px] text-muted-foreground">
                Checking access
              </Badge>
              <CardTitle>Loading workspace access…</CardTitle>
            </CardHeader>
          </Card>
        </main>
      ) : isAppRoute ? (
        user ? <AppWorkspace /> : <LoginGate />
      ) : user ? (
        <AppWorkspace />
      ) : (
        <LandingPage />
      )}
    </div>
  )
}

export default App
