import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  Download,
  FilePlus2,
  Filter,
  LogIn,
  LogOut,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
} from 'lucide-react'
import { getRedirectResult, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut, type User } from 'firebase/auth'
import './App.css'
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

const statusTone: Record<Status, string> = {
  matched: 'green',
  'missing docs': 'amber',
  'needs review': 'blue',
  exception: 'red',
  ignored: 'gray',
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

function LandingPage() {
  return (
    <main className="page-shell landing-shell">
      <section className="hero-section clean-hero landing-only">
        <div className="hero-copy">
          <span className="eyebrow">For bookkeepers and small finance teams</span>
          <h1>Turn statement exports into a clean list of unresolved reconciliation work.</h1>
          <p className="hero-text">
            Import a statement export, identify missing support, and leave close with a short list of items that still need follow-up.
          </p>
          <div className="hero-actions">
            <a className="primary-btn" href="/app">Open the app <ArrowRight size={16} /></a>
            <a className="secondary-btn" href="/sample-transactions.csv" download>Download sample CSV</a>
          </div>
          <div className="hero-points compact-points">
            <span><CheckCircle2 size={16} /> import statement or card CSV</span>
            <span><CheckCircle2 size={16} /> review missing docs and exceptions</span>
            <span><CheckCircle2 size={16} /> export unresolved follow-up items</span>
          </div>
        </div>
        <div className="hero-summary landing-summary">
          <div className="summary-line"><span>Import</span><strong>CSV</strong></div>
          <div className="summary-line"><span>Review</span><strong>Status + notes</strong></div>
          <div className="summary-line"><span>Output</span><strong>Unresolved queue</strong></div>
        </div>
      </section>

      <section className="workflow-strip" id="workflow">
        <div className="workflow-step">
          <strong>1. Import</strong>
          <p>Upload a CSV export from your bank, card, or accounting workflow.</p>
        </div>
        <div className="workflow-step">
          <strong>2. Review</strong>
          <p>Mark items as matched, missing docs, needs review, or exception.</p>
        </div>
        <div className="workflow-step">
          <strong>3. Follow up</strong>
          <p>Export unresolved items and keep notes attached to each transaction.</p>
        </div>
      </section>

      <section className="info-grid" id="benefits">
        <div className="info-block">
          <h3>Designed around unresolved work</h3>
          <p>Focus on the items that still need support, clarification, or follow-up instead of treating reconciliation like a giant spreadsheet.</p>
        </div>
        <div className="info-block">
          <h3>Faster time to value</h3>
          <p>Import a file, review statuses, and get an actionable unresolved list in minutes.</p>
        </div>
        <div className="info-block">
          <h3>Built for small teams</h3>
          <p>Recon Workspace sits between manual spreadsheet cleanup and heavyweight enterprise close software.</p>
        </div>
      </section>

      <section className="cta-section minimal">
        <div className="cta-card simple">
          <span className="eyebrow">Try the workflow</span>
          <h2>Use sample data first. Sign in when you want to save your real workspace.</h2>
          <p>The app is separate from the landing page. Open the product, try sample data, and use Google sign-in when you’re ready to save work.</p>
          <div className="hero-actions compact">
            <a className="primary-btn" href="/app">Open the app</a>
            <a className="secondary-btn" href="/sample-transactions.csv" download>Download sample CSV</a>
          </div>
        </div>
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
  const [noteDraft, setNoteDraft] = useState((initial ?? seedTransactions)[0]?.note ?? '')
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

    const unsub = onAuthStateChanged(firebaseAuth, async (nextUser) => {
      setUser(nextUser)

      if (nextUser) {
        try {
          setLoadingCloud(true)
          const cloudItems = await loadWorkspaceTransactions(nextUser.uid)
          if (cloudItems.length) {
            setItems(cloudItems)
            setSelectedId(cloudItems[0].id)
            setCloudMessage(`Loaded ${cloudItems.length} transactions from cloud.`)
          } else {
            setCloudMessage('Signed in. Start by importing a CSV or adding a transaction, then save your workspace.')
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown cloud load error'
          setCloudMessage(`Cloud load error: ${message}`)
        } finally {
          setLoadingCloud(false)
        }
      }
    })

    return () => unsub()
  }, [])

  const filtered = useMemo(() => {
    return items.filter((txn) => {
      const statusMatch = selectedStatus === 'all' || txn.status === selectedStatus
      const searchMatch =
        !search ||
        [txn.merchant, txn.memo, txn.source, txn.note].join(' ').toLowerCase().includes(search.toLowerCase())
      return statusMatch && searchMatch
    })
  }, [items, selectedStatus, search])

  const selected = filtered.find((txn) => txn.id === selectedId) ?? filtered[0] ?? items[0] ?? null

  useEffect(() => {
    if (selected) {
      setSelectedId(selected.id)
      setNoteDraft(selected.note)
    }
  }, [selected?.id])

  const stats = useMemo(() => {
    const unresolved = items.filter((t) => ['missing docs', 'needs review', 'exception'].includes(t.status))
    return {
      total: items.length,
      unresolved: unresolved.length,
      missingDocs: items.filter((t) => t.status === 'missing docs').length,
      exceptions: items.filter((t) => t.status === 'exception').length,
      matched: items.filter((t) => t.status === 'matched').length,
    }
  }, [items])

  function updateSelected(patch: Partial<Transaction>) {
    if (!selected) return
    setItems((current) => current.map((txn) => (txn.id === selected.id ? { ...txn, ...patch } : txn)))
  }

  function addActivity(text: string) {
    if (!selected) return
    const stamp = new Date().toLocaleString()
    setItems((current) =>
      current.map((txn) =>
        txn.id === selected.id
          ? { ...txn, activity: [{ at: stamp, text }, ...txn.activity] }
          : txn,
      ),
    )
  }

  function handleNoteSave() {
    if (!selected) return
    updateSelected({ note: noteDraft })
    addActivity('Updated reconciliation note')
    setCloudMessage('Note saved locally.')
  }

  async function handleCsvUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const parsed = parseCsvTransactions(text)
    if (!parsed.length) {
      setCloudMessage('No valid transactions were found in that CSV. Use columns like date, merchant, memo, amount, source, status.')
      return
    }

    const summary = buildImportSummary(parsed)
    setLastImportSummary(summary)
    setItems((current) => [...parsed, ...current])
    setSelectedId(parsed[0].id)
    setCloudMessage(`Imported ${parsed.length} transactions from CSV.`)
  }

  async function signInWithGoogle() {
    if (!firebaseAuth || !googleProvider) return

    const isSmallScreen = window.matchMedia('(max-width: 720px)').matches

    try {
      if (isSmallScreen) {
        await signInWithRedirect(firebaseAuth, googleProvider)
        return
      }
      await signInWithPopup(firebaseAuth, googleProvider)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Google sign-in failed'
      setCloudMessage(`Login issue: ${message}`)
      await signInWithRedirect(firebaseAuth, googleProvider)
    }
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
    const remaining = items.filter((txn) => txn.id !== selected.id)
    setItems(remaining)
    if (remaining.length) {
      setSelectedId(remaining[0].id)
      setCloudMessage('Transaction deleted.')
    } else {
      setCloudMessage('Transaction deleted. Workspace is now empty.')
    }
  }

  const unresolvedText = unresolvedSummary(items)
  const cloudEnabled = isFirebaseConfigured
  const isEmpty = items.length === 0

  return (
    <main className="workspace-shell">
      <section className="workspace-header dense">
        <div>
          <span className="eyebrow">App</span>
          <h1>Reconciliation workspace</h1>
          <p>{user ? 'Signed in workspace. Save your changes anytime.' : 'Sign in to save work. You can still explore the app with sample or local data.'}</p>
        </div>
        <div className="workspace-header-actions">
          <button className="secondary-btn" onClick={() => setShowAddForm((v) => !v)}><Plus size={16} /> {showAddForm ? 'Close form' : 'Add transaction'}</button>
          <label className="secondary-btn clickable">
            <Upload size={15} /> Import CSV
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleCsvUpload} hidden />
          </label>
          <a className="secondary-btn" href="/sample-transactions.csv" download>Download sample CSV</a>
          <button className="secondary-btn" onClick={() => downloadTextFile('unresolved-items.txt', unresolvedText)}><Download size={15} /> Export unresolved</button>
          {!user && cloudEnabled ? (
            <button className="primary-btn" onClick={signInWithGoogle}><LogIn size={16} /> Sign in with Google</button>
          ) : (
            <button className="primary-btn" onClick={saveToCloud} disabled={saving || !cloudEnabled}><Save size={16} /> {saving ? 'Saving…' : 'Save'}</button>
          )}
        </div>
      </section>

      <section className="entry-banner">
        <div className="entry-copy">
          <strong>How to use this</strong>
          <span>Import a CSV from your bank statement, card export, or accounting workflow. Then review unresolved items and save your workspace if you want it synced.</span>
        </div>
        {user && cloudEnabled && (
          <button className="secondary-btn" onClick={handleSignOut}><LogOut size={16} /> Sign out</button>
        )}
      </section>

      {lastImportSummary && (
        <section className="import-summary">
          <div className="import-summary-card">
            <strong>Last import</strong>
            <span>{lastImportSummary.imported} transactions imported</span>
          </div>
          <div className="import-summary-card">
            <strong>{lastImportSummary.unresolved}</strong>
            <span>need action</span>
          </div>
          <div className="import-summary-card">
            <strong>{lastImportSummary.missingDocs}</strong>
            <span>missing docs</span>
          </div>
          <div className="import-summary-card">
            <strong>{lastImportSummary.exceptions}</strong>
            <span>exceptions</span>
          </div>
          <div className="import-summary-note">
            Next step: review <strong>missing docs</strong> and <strong>exception</strong> items first, then export unresolved follow-up.
          </div>
        </section>
      )}

      <section className="status-banner slim">
        <div>
          <strong>
            {cloudEnabled
              ? user
                ? `Signed in as ${user.email ?? 'Google user'}`
                : 'Google sign-in available'
              : 'Cloud save not configured'}
          </strong>
          <span>
            {loadingCloud
              ? 'Loading your workspace…'
              : cloudMessage ||
                (cloudEnabled
                  ? user
                    ? 'Your workspace is ready to save across devices.'
                    : 'Sign in to keep your reconciliation workspace synced.'
                  : 'Cloud save will be available once the hosted environment is fully configured.')}
          </span>
        </div>
        {user && <button className="secondary-btn" onClick={saveToCloud} disabled={saving}>{saving ? 'Saving…' : 'Save now'}</button>}
      </section>

      {showAddForm && (
        <section className="add-form dense-form">
          <div className="form-row three">
            <label>
              <span>Date</span>
              <input type="date" value={draft.date} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} />
            </label>
            <label>
              <span>Merchant</span>
              <input value={draft.merchant} onChange={(e) => setDraft((d) => ({ ...d, merchant: e.target.value }))} placeholder="Vendor or merchant" />
            </label>
            <label>
              <span>Amount</span>
              <input type="number" step="0.01" value={draft.amount} onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))} placeholder="-125.00" />
            </label>
          </div>
          <div className="form-row three">
            <label>
              <span>Source</span>
              <input value={draft.source} onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value }))} placeholder="Corporate Card" />
            </label>
            <label>
              <span>Status</span>
              <select value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as Status }))}>
                {statusOrder.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
            <label>
              <span>Memo</span>
              <input value={draft.memo} onChange={(e) => setDraft((d) => ({ ...d, memo: e.target.value }))} placeholder="Memo" />
            </label>
          </div>
          <label>
            <span>Note</span>
            <textarea rows={2} value={draft.note} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} placeholder="What still needs to happen?" />
          </label>
          <div className="form-actions">
            <button className="primary-btn" onClick={handleCreateTransaction}><FilePlus2 size={16} /> Add transaction</button>
            <button className="secondary-btn" onClick={() => setDraft(emptyDraft)}>Clear</button>
          </div>
        </section>
      )}

      <section className="summary-grid compact-summary data-strip">
        <div className="summary-box"><span>Total</span><strong>{stats.total}</strong></div>
        <div className="summary-box"><span>Matched</span><strong>{stats.matched}</strong></div>
        <div className="summary-box"><span>Missing docs</span><strong>{stats.missingDocs}</strong></div>
        <div className="summary-box"><span>Exceptions</span><strong>{stats.exceptions}</strong></div>
      </section>

      {isEmpty ? (
        <section className="empty-state compact-empty">
          <h2>No transactions yet</h2>
          <p>Start with the sample CSV or import a statement export to see unresolved reconciliation work immediately.</p>
          <div className="hero-actions compact">
            <a className="secondary-btn" href="/sample-transactions.csv" download>Download sample CSV</a>
            <label className="primary-btn clickable">
              <Upload size={15} /> Import CSV
              <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleCsvUpload} hidden />
            </label>
            <button className="secondary-btn" onClick={() => setShowAddForm(true)}><Plus size={16} /> Add first transaction</button>
          </div>
        </section>
      ) : (
        <section className="workspace-grid dense-grid alt-layout">
          <aside className="sidebar-rail">
            <div className="rail-section-title">Views</div>
            <button className={selectedStatus === 'all' ? 'status-link active' : 'status-link'} onClick={() => setSelectedStatus('all')}>
              All items <span>{items.length}</span>
            </button>
            {statusOrder.map((status) => (
              <button
                key={status}
                className={selectedStatus === status ? 'status-link active' : 'status-link'}
                onClick={() => setSelectedStatus(status)}
              >
                <span className={`dot ${statusTone[status]}`} />
                {status}
                <span>{items.filter((t) => t.status === status).length}</span>
              </button>
            ))}
          </aside>

          <div className="table-surface wide">
            <div className="table-toolbar dense-toolbar">
              <div className="surface-title-group">
                <h3>Transactions</h3>
                <span>{filtered.length} visible</span>
              </div>
              <div className="searchbar compact-search">
                <Search size={16} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search merchant, memo, source, or note"
                />
                <Filter size={16} />
              </div>
            </div>
            <div className="table-head row recon-head">
              <span>Date</span>
              <span>Transaction</span>
              <span>Amount</span>
              <span>Status</span>
              <span>Docs</span>
            </div>
            <div className="table-body grid-body">
              {filtered.map((txn) => (
                <button
                  key={txn.id}
                  className={txn.id === selected?.id ? 'txn-row row active' : 'txn-row row'}
                  onClick={() => setSelectedId(txn.id)}
                >
                  <span>{txn.date}</span>
                  <span>
                    <strong>{txn.merchant}</strong>
                    <small>{txn.memo}</small>
                  </span>
                  <span className={txn.amount < 0 ? 'negative' : 'positive'}>{currency(txn.amount)}</span>
                  <span><span className={`badge ${statusTone[txn.status]}`}>{txn.status}</span></span>
                  <span>{txn.matchedDocs}</span>
                </button>
              ))}
            </div>
          </div>

          <aside className="detail-surface">
            <div className="surface-title-group detail-title-group">
              <h3>Details</h3>
              <span>{selected ? selected.status : 'No selection'}</span>
            </div>
            {selected ? (
              <>
                <div className="detail-top compact-detail-top">
                  <span className={`badge ${statusTone[selected.status]}`}>{selected.status}</span>
                  <h3>{selected.merchant}</h3>
                  <p>{selected.memo}</p>
                </div>
                <section className="detail-section">
                  <dl className="detail-grid compact-detail-grid">
                    <div><dt>Date</dt><dd>{selected.date}</dd></div>
                    <div><dt>Source</dt><dd>{selected.source}</dd></div>
                    <div><dt>Amount</dt><dd>{currency(selected.amount)}</dd></div>
                    <div><dt>Docs</dt><dd>{selected.matchedDocs}</dd></div>
                  </dl>
                </section>
                <section className="detail-section">
                  <h4>Status</h4>
                  <div className="status-actions wrap-tight">
                    {statusOrder.map((status) => (
                      <button
                        key={status}
                        className={selected.status === status ? `status-chip active ${statusTone[status]}` : `status-chip ${statusTone[status]}`}
                        onClick={() => {
                          updateSelected({ status })
                          addActivity(`Changed status to ${status}`)
                        }}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </section>
                <section className="detail-section">
                  <h4>Note</h4>
                  <textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} rows={3} />
                  <div className="detail-actions">
                    <button className="primary-btn small" onClick={handleNoteSave}>Save note</button>
                    <button className="secondary-btn small" onClick={() => {
                      updateSelected({ matchedDocs: selected.matchedDocs + 1 })
                      addActivity('Attached one supporting document')
                    }}>Add doc</button>
                    <button className="secondary-btn small danger" onClick={handleDeleteSelected}><Trash2 size={14} /> Delete</button>
                  </div>
                </section>
                <section className="detail-section">
                  <h4>Next action</h4>
                  <p>
                    {selected.status === 'missing docs'
                      ? 'Request receipt and business purpose, then keep item unresolved until attached.'
                      : selected.status === 'exception'
                        ? 'Review variance against payout support and confirm whether refund timing explains mismatch.'
                        : selected.status === 'needs review'
                          ? 'Confirm classification and attach support before month-end close.'
                          : 'Ready for close unless new variance appears.'}
                  </p>
                </section>
                <section className="detail-section">
                  <h4>Activity</h4>
                  <ul className="activity-list">
                    {selected.activity.map((item) => (
                      <li key={item.at + item.text}>
                        <strong>{item.at}</strong>
                        <span>{item.text}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            ) : (
              <div className="empty-inline">Select a transaction to see details.</div>
            )}
          </aside>
        </section>
      )}
    </main>
  )
}

function LoginGate() {
  const [gateMessage, setGateMessage] = useState('')

  async function handleGateSignIn() {
    if (!firebaseAuth || !googleProvider) return

    const isSmallScreen = window.matchMedia('(max-width: 720px)').matches

    try {
      if (isSmallScreen) {
        await signInWithRedirect(firebaseAuth, googleProvider)
        return
      }
      await signInWithPopup(firebaseAuth, googleProvider)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Google sign-in failed'
      setGateMessage(`Login issue: ${message}`)
      await signInWithRedirect(firebaseAuth, googleProvider)
    }
  }

  return (
    <main className="page-shell landing-shell">
      <section className="hero-section clean-hero landing-only">
        <div className="hero-copy">
          <span className="eyebrow">Sign in required</span>
          <h1>Use Google sign-in to access the reconciliation workspace.</h1>
          <p className="hero-text">
            Sample CSV is public, but the actual app workspace now opens only after login.
          </p>
          <div className="hero-actions">
            <button className="primary-btn" onClick={handleGateSignIn}><LogIn size={16} /> Sign in with Google</button>
            <a className="secondary-btn" href="/sample-transactions.csv" download>Download sample CSV</a>
          </div>
          <div className="hero-points compact-points">
            <span><CheckCircle2 size={16} /> import statement or card CSV</span>
            <span><CheckCircle2 size={16} /> review missing docs and exceptions</span>
            <span><CheckCircle2 size={16} /> save synced workspace after login</span>
          </div>
          {gateMessage && <p className="cloud-message">{gateMessage}</p>}
        </div>
        <div className="hero-summary landing-summary">
          <div className="summary-line"><span>Access</span><strong>Login</strong></div>
          <div className="summary-line"><span>Sample</span><strong>CSV only</strong></div>
          <div className="summary-line"><span>Workspace</span><strong>Protected</strong></div>
        </div>
      </section>
    </main>
  )
}

function App() {
  const [path, setPath] = useState(typeof window !== 'undefined' ? window.location.pathname : '/')
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const isAppRoute = path === '/app'

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    if (!firebaseAuth) {
      setAuthReady(true)
      return
    }

    const unsub = onAuthStateChanged(firebaseAuth, (nextUser) => {
      setUser(nextUser)
      setAuthReady(true)

      if (nextUser && window.location.pathname !== '/app') {
        window.location.replace('/app')
      }
    })

    return () => unsub()
  }, [])

  return (
    <div className="app-root">
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href={user ? '/app' : '/'}>
            <span className="brand-mark">R</span>
            <span>Recon Workspace</span>
          </a>
          <nav className="topnav">
            {!user && <a className={isAppRoute ? 'nav-btn' : 'nav-btn active'} href="/">Overview</a>}
            <a className={isAppRoute ? 'nav-btn active' : 'nav-btn'} href="/app">App</a>
          </nav>
          <div className="topbar-actions">
            <a className="secondary-btn" href="/sample-transactions.csv" download>Sample CSV</a>
            {!user && <a className="primary-btn" href="/app">Open app</a>}
          </div>
        </div>
      </header>
      {isAppRoute ? (authReady && user ? <AppWorkspace /> : <LoginGate />) : user ? <AppWorkspace /> : <LandingPage />}
    </div>
  )
}

export default App
