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
import { getRedirectResult, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut, type User } from 'firebase/auth'
import './App.css'
import { statusOrder, transactions as seedTransactions, type Status, type Transaction } from './data'
import { firebaseAuth, googleProvider, isFirebaseConfigured } from './firebase'
import { loadWorkspaceTransactions, saveWorkspaceTransactions } from './firestore'
import { loadTransactions, saveTransactions } from './storage'
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
  const [user, setUser] = useState<User | null>(null)
  const [cloudMessage, setCloudMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadingCloud, setLoadingCloud] = useState(false)
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
            setCloudMessage('Signed in. Your cloud workspace is empty for now.')
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

  const unresolvedText = unresolvedSummary(items)
  const cloudEnabled = isFirebaseConfigured

  return (
    <div className="page-shell">
      <section className="hero-section">
        <div className="hero-copy">
          <span className="eyebrow">Recon Workspace</span>
          <h1>Keep reconciliation work organized before month-end gets messy.</h1>
          <p className="hero-text">
            Review transactions, track missing supporting documents, and stay on top of unresolved exceptions in one workspace built for bookkeepers and small finance teams.
          </p>
          <div className="hero-actions">
            <a className="primary-btn" href="#demo">See how it works <ArrowRight size={16} /></a>
            <a className="secondary-btn" href="#benefits">Why teams switch</a>
          </div>
          <div className="hero-points">
            <span><CheckCircle2 size={16} /> spot missing support faster</span>
            <span><CheckCircle2 size={16} /> keep unresolved items visible</span>
            <span><CheckCircle2 size={16} /> reduce month-end scramble</span>
          </div>
        </div>
        <div className="hero-card auth-card">
          <div className="hero-card-header">
            <ShieldCheck size={18} />
            <span>For live work, not just month-end panic</span>
          </div>
          <p className="auth-copy">
            Keep transaction review, missing support, and unresolved exceptions in one clean workspace so nothing gets lost between spreadsheets, inboxes, and notes.
          </p>
          <div className="auth-stack">
            <div className="auth-state">
              <strong>Stop juggling spreadsheets, inbox threads, and loose notes</strong>
              <span>Keep every transaction in a clear status, add notes in context, and export unresolved items when it’s time to follow up.</span>
            </div>
            <div className="hero-actions compact">
              {cloudEnabled && !user && (
                <button className="primary-btn" onClick={signInWithGoogle}><LogIn size={16} /> Continue with Google</button>
              )}
              {cloudEnabled && user && (
                <>
                  <button className="primary-btn" onClick={saveToCloud} disabled={saving}><Save size={16} /> {saving ? 'Saving…' : 'Save workspace'}</button>
                  <button className="secondary-btn" onClick={handleSignOut}><LogOut size={16} /> Sign out</button>
                </>
              )}
              {!cloudEnabled && <a className="secondary-btn" href="#demo">Explore the workspace</a>}
            </div>
            <div className="auth-state subtle">
              <strong>
                {cloudEnabled
                  ? user
                    ? `Signed in as ${user.email ?? 'Google user'}`
                    : 'Google sign-in available'
                  : 'Firebase config needed'}
              </strong>
              <span>
                {loadingCloud
                  ? 'Loading your workspace…'
                  : cloudMessage ||
                    (cloudEnabled
                      ? user
                        ? 'Your workspace is ready to save across devices.'
                        : 'Sign in to keep your reconciliation workspace synced. If login fails, check Google provider and authorized domain settings in Firebase Auth.'
                      : 'Cloud save will be available once the hosted environment is fully configured.')}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="docs-strip" id="benefits">
        <div className="doc-card">
          <FolderOpen size={18} />
          <div>
            <h3>See unresolved items early</h3>
            <p>Instead of finding problems at the end of the month, surface missing docs and exceptions while there’s still time to fix them.</p>
          </div>
        </div>
        <div className="doc-card">
          <FileText size={18} />
          <div>
            <h3>Keep reconciliation work in one place</h3>
            <p>Notes, status, supporting docs, and follow-up context stay tied to the transaction instead of getting scattered across tools.</p>
          </div>
        </div>
      </section>

      <section className="target-strip">
        <div className="target-card">
          <h3>Who it’s for</h3>
          <ul>
            <li>Bookkeepers handling multiple clients</li>
            <li>Small finance teams closing messy books</li>
            <li>Operators who need cleaner support before close</li>
          </ul>
        </div>
        <div className="target-card">
          <h3>Common pain points</h3>
          <ul>
            <li>Missing receipts discovered too late</li>
            <li>Unclear transactions buried in notes</li>
            <li>Exceptions scattered across spreadsheets and email</li>
          </ul>
        </div>
        <div className="target-card">
          <h3>Why teams switch</h3>
          <ul>
            <li>Less spreadsheet cleanup</li>
            <li>Cleaner follow-up before month-end</li>
            <li>Better visibility into what still blocks close</li>
          </ul>
        </div>
      </section>

      <section className="demo-section" id="demo">
        <div className="demo-header">
          <div>
            <span className="eyebrow">Product walkthrough</span>
            <h2>A cleaner reconciliation workflow</h2>
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
          <h3>Built for the messy part of close</h3>
          <p>When receipts are missing, transactions are unclear, and support is scattered, Recon Workspace gives your team a cleaner way to get to done.</p>
        </div>
        <div className="mini-card">
          <CheckCircle2 size={18} />
          <h3>Made for small finance teams</h3>
          <p>Too much for spreadsheets. Too little for enterprise close software. Recon Workspace is designed for the teams in between.</p>
        </div>
        <div className="mini-card">
          <FileText size={18} />
          <h3>Faster follow-up, fewer surprises</h3>
          <p>Export unresolved items, keep decision notes attached to each transaction, and make month-end review less chaotic.</p>
        </div>
      </section>

      <section className="cta-section">
        <div className="cta-card">
          <span className="eyebrow">Early access</span>
          <h2>Want a cleaner way to get unresolved items off your plate?</h2>
          <p>
            Recon Workspace is for bookkeepers and small finance teams who want fewer spreadsheet workarounds and a clearer path to close.
          </p>
          <div className="hero-actions compact">
            <a className="primary-btn" href="mailto:hello@reconworkspace.app?subject=Recon%20Workspace%20interest">Request early access</a>
            <a className="secondary-btn" href="#demo">See the walkthrough</a>
          </div>
          <p className="cta-footnote">Current priority: get the signed-in workflow reliable, then keep polishing the day-to-day reconciliation experience.</p>
        </div>
      </section>
    </div>
  )
}

export default App
