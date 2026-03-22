import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  Filter,
  FolderOpen,
  LogIn,
  LogOut,
  Save,
  Search,
  ShieldCheck,
  Upload,
} from 'lucide-react'
import './App.css'
import { statusOrder, transactions as seedTransactions, type Status, type Transaction } from './data'
import { loadTransactions, saveTransactions } from './storage'
import { isSupabaseConfigured, supabase } from './supabase'
import { currency, parseCsvTransactions, unresolvedSummary } from './utils'

const statusTone: Record<Status, string> = {
  matched: 'green',
  'missing docs': 'amber',
  'needs review': 'blue',
  exception: 'red',
  ignored: 'gray',
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

function App() {
  const initial = typeof window !== 'undefined' ? loadTransactions() : null
  const [items, setItems] = useState<Transaction[]>(initial ?? seedTransactions)
  const [selectedStatus, setSelectedStatus] = useState<Status | 'all'>('all')
  const [selectedId, setSelectedId] = useState((initial ?? seedTransactions)[0].id)
  const [search, setSearch] = useState('')
  const [noteDraft, setNoteDraft] = useState((initial ?? seedTransactions)[0].note)
  const [sessionEmail, setSessionEmail] = useState<string | null>(null)
  const [cloudMessage, setCloudMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    saveTransactions(items)
  }, [items])

  useEffect(() => {
    if (!supabase) return

    supabase.auth.getSession().then(({ data }) => {
      setSessionEmail(data.session?.user?.email ?? null)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionEmail(session?.user?.email ?? null)
    })

    return () => listener.subscription.unsubscribe()
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

  const selected = filtered.find((txn) => txn.id === selectedId) ?? filtered[0] ?? items[0]

  useEffect(() => {
    if (selected) {
      setSelectedId(selected.id)
      setNoteDraft(selected.note)
    }
  }, [selected?.id])

  function updateSelected(patch: Partial<Transaction>) {
    setItems((current) => current.map((txn) => (txn.id === selected.id ? { ...txn, ...patch } : txn)))
  }

  function addActivity(text: string) {
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
    updateSelected({ note: noteDraft })
    addActivity('Updated reconciliation note')
  }

  async function handleCsvUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const parsed = parseCsvTransactions(text)
    if (!parsed.length) return
    setItems((current) => [...parsed, ...current])
    setSelectedId(parsed[0].id)
  }

  function resetDemo() {
    setItems(seedTransactions)
    setSelectedId(seedTransactions[0].id)
    setSearch('')
    setSelectedStatus('all')
    setCloudMessage('')
  }

  async function signInWithGoogle() {
    if (!supabase) return
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    })
  }

  async function signOut() {
    if (!supabase) return
    await supabase.auth.signOut()
    setCloudMessage('Signed out.')
  }

  async function saveToCloud() {
    if (!supabase) {
      setCloudMessage('Supabase is not configured yet. Add env vars to enable cloud save.')
      return
    }

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      setCloudMessage('Please sign in with Google first.')
      return
    }

    setSaving(true)
    setCloudMessage('')

    const userId = session.user.id

    const { data: existingWorkspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id,name,owner_user_id')
      .eq('owner_user_id', userId)
      .limit(1)
      .maybeSingle()

    if (workspaceError) {
      setSaving(false)
      setCloudMessage(`Workspace error: ${workspaceError.message}`)
      return
    }

    let workspaceId = existingWorkspace?.id

    if (!workspaceId) {
      const { data: createdWorkspace, error: createWorkspaceError } = await supabase
        .from('workspaces')
        .insert({ owner_user_id: userId, name: 'Default Workspace' })
        .select('id')
        .single()

      if (createWorkspaceError || !createdWorkspace) {
        setSaving(false)
        setCloudMessage(`Create workspace error: ${createWorkspaceError?.message ?? 'Unknown error'}`)
        return
      }

      workspaceId = createdWorkspace.id
    }

    const rows = items.map((item) => ({
      id: item.id,
      workspace_id: workspaceId,
      user_id: userId,
      date: item.date,
      merchant: item.merchant,
      memo: item.memo,
      amount: item.amount,
      source: item.source,
      status: item.status,
      matched_docs: item.matchedDocs,
      note: item.note,
      activity: item.activity,
      updated_at: new Date().toISOString(),
    }))

    const { error: upsertError } = await supabase.from('transactions').upsert(rows)

    setSaving(false)

    if (upsertError) {
      setCloudMessage(`Cloud save error: ${upsertError.message}`)
      return
    }

    setCloudMessage(`Saved ${rows.length} transactions to cloud.`)
  }

  const unresolvedText = unresolvedSummary(items)
  const cloudEnabled = isSupabaseConfigured

  return (
    <div className="page-shell">
      <section className="hero-section">
        <div className="hero-copy">
          <span className="eyebrow">Recon Workspace</span>
          <h1>Reconcile statements. Track exceptions. Close faster.</h1>
          <p className="hero-text">
            A reconciliation workspace for bookkeepers and small finance teams who are tired of managing
            missing receipts, unmatched transactions, and month-end exceptions in spreadsheets.
          </p>
          <div className="hero-actions">
            <a className="primary-btn" href="#demo">View demo workspace <ArrowRight size={16} /></a>
            <a className="secondary-btn" href="#docs">Product docs</a>
          </div>
          <div className="hero-points">
            <span><CheckCircle2 size={16} /> status-first workflow</span>
            <span><CheckCircle2 size={16} /> exception tracking</span>
            <span><CheckCircle2 size={16} /> supporting-doc follow-up</span>
          </div>
        </div>
        <div className="hero-card auth-card">
          <div className="hero-card-header">
            <ShieldCheck size={18} />
            <span>Auth + cloud save</span>
          </div>
          <p className="auth-copy">
            Demo mode works without login. Real workspace persistence is designed for Google sign-in via Supabase.
          </p>
          <div className="auth-stack">
            <div className="auth-state">
              <strong>{cloudEnabled ? (sessionEmail ? 'Cloud ready' : 'Google login available') : 'Demo mode only'}</strong>
              <span>{cloudEnabled ? (sessionEmail ?? 'Sign in to save transactions to cloud') : 'Add Supabase env vars to enable auth + database'}</span>
            </div>
            <div className="hero-actions compact">
              {cloudEnabled && !sessionEmail && (
                <button className="primary-btn" onClick={signInWithGoogle}><LogIn size={16} /> Continue with Google</button>
              )}
              {cloudEnabled && sessionEmail && (
                <>
                  <button className="primary-btn" onClick={saveToCloud} disabled={saving}><Save size={16} /> {saving ? 'Saving…' : 'Save to cloud'}</button>
                  <button className="secondary-btn" onClick={signOut}><LogOut size={16} /> Sign out</button>
                </>
              )}
            </div>
            {cloudMessage && <p className="cloud-message">{cloudMessage}</p>}
          </div>
        </div>
      </section>

      <section className="docs-strip" id="docs">
        <div className="doc-card">
          <FolderOpen size={18} />
          <div>
            <h3>Docs included</h3>
            <p>vision, MVP scope, GTM outline, architecture notes, Supabase setup, and content assets are committed in <code>/docs</code>.</p>
          </div>
        </div>
        <div className="doc-card">
          <FileText size={18} />
          <div>
            <h3>Wedge</h3>
            <p>Start with unresolved transactions and missing supporting documents, not full accounting.</p>
          </div>
        </div>
      </section>

      <section className="demo-section" id="demo">
        <div className="demo-header">
          <div>
            <span className="eyebrow">Interactive MVP</span>
            <h2>Sample reconciliation workspace</h2>
          </div>
          <div className="toolbar">
            <label className="toolbar-pill clickable">
              <Upload size={15} /> Import CSV
              <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleCsvUpload} hidden />
            </label>
            <button className="toolbar-pill" onClick={() => downloadTextFile('unresolved-items.txt', unresolvedText)}><Download size={15} /> Export unresolved</button>
            <button className="toolbar-pill" onClick={resetDemo}>Reset demo</button>
          </div>
        </div>

        <div className="workspace-grid">
          <aside className="panel sidebar">
            <h3>Status views</h3>
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
            <div className="sidebar-note">
              <Clock3 size={16} />
              <p>Most teams waste time on unresolved items, not the easy matches.</p>
            </div>
          </aside>

          <div className="panel table-panel">
            <div className="searchbar">
              <Search size={16} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search merchant, memo, source, or note"
              />
              <Filter size={16} />
            </div>
            <div className="table-head row">
              <span>Date</span>
              <span>Merchant</span>
              <span>Amount</span>
              <span>Status</span>
              <span>Docs</span>
            </div>
            <div className="table-body">
              {filtered.map((txn) => (
                <button
                  key={txn.id}
                  className={txn.id === selected.id ? 'txn-row row active' : 'txn-row row'}
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

          <aside className="panel detail-panel">
            <div className="detail-top">
              <span className={`badge ${statusTone[selected.status]}`}>{selected.status}</span>
              <h3>{selected.merchant}</h3>
              <p>{selected.memo}</p>
            </div>
            <dl className="detail-grid">
              <div><dt>Date</dt><dd>{selected.date}</dd></div>
              <div><dt>Source</dt><dd>{selected.source}</dd></div>
              <div><dt>Amount</dt><dd>{currency(selected.amount)}</dd></div>
              <div><dt>Attached docs</dt><dd>{selected.matchedDocs}</dd></div>
            </dl>
            <div className="detail-block">
              <h4>Update status</h4>
              <div className="status-actions">
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
            </div>
            <div className="detail-block">
              <h4>Bookkeeper note</h4>
              <textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} rows={4} />
              <div className="detail-actions">
                <button className="primary-btn small" onClick={handleNoteSave}>Save note</button>
                <button className="secondary-btn small" onClick={() => {
                  updateSelected({ matchedDocs: selected.matchedDocs + 1 })
                  addActivity('Attached one supporting document')
                }}>Add doc</button>
              </div>
            </div>
            <div className="detail-block">
              <h4>Suggested next action</h4>
              <p>
                {selected.status === 'missing docs'
                  ? 'Request receipt and business purpose, then keep item unresolved until attached.'
                  : selected.status === 'exception'
                    ? 'Review variance against payout support and confirm whether refund timing explains mismatch.'
                    : selected.status === 'needs review'
                      ? 'Confirm classification and attach support before month-end close.'
                      : 'Ready for close unless new variance appears.'}
              </p>
            </div>
            <div className="detail-block">
              <h4>Activity log</h4>
              <ul className="activity-list">
                {selected.activity.map((item) => (
                  <li key={item.at + item.text}>
                    <strong>{item.at}</strong>
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </section>

      <section className="positioning-section">
        <div className="mini-card">
          <AlertCircle size={18} />
          <h3>Not another accounting system</h3>
          <p>Recon Workspace lives before the books are clean — in the messy prep layer where files, receipts, statements, and exceptions still need human review.</p>
        </div>
        <div className="mini-card">
          <CheckCircle2 size={18} />
          <h3>First wedge</h3>
          <p>Missing-doc chasing and unresolved item tracking are the sharpest entry point for bookkeeping agencies and small finance teams.</p>
        </div>
        <div className="mini-card">
          <FileText size={18} />
          <h3>Now structured for cloud mode</h3>
          <p>Demo mode works without login. Cloud mode is prepared for Google sign-in and Supabase-backed transaction persistence.</p>
        </div>
      </section>
    </div>
  )
}

export default App
