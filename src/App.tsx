import { useMemo, useState } from 'react'
import { AlertCircle, ArrowRight, CheckCircle2, Clock3, FileText, Filter, FolderOpen, Search, Sparkles } from 'lucide-react'
import './App.css'
import { statusOrder, transactions, type Status } from './data'

const statusTone: Record<Status, string> = {
  matched: 'green',
  'missing docs': 'amber',
  'needs review': 'blue',
  exception: 'red',
  ignored: 'gray',
}

function currency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(amount)
}

function App() {
  const [selectedStatus, setSelectedStatus] = useState<Status | 'all'>('all')
  const [selectedId, setSelectedId] = useState(transactions[0].id)

  const filtered = useMemo(() => {
    return selectedStatus === 'all'
      ? transactions
      : transactions.filter((txn) => txn.status === selectedStatus)
  }, [selectedStatus])

  const selected = filtered.find((txn) => txn.id === selectedId) ?? filtered[0] ?? transactions[0]

  const stats = useMemo(() => {
    const unresolved = transactions.filter((t) => ['missing docs', 'needs review', 'exception'].includes(t.status))
    return {
      total: transactions.length,
      unresolved: unresolved.length,
      missingDocs: transactions.filter((t) => t.status === 'missing docs').length,
      exceptions: transactions.filter((t) => t.status === 'exception').length,
    }
  }, [])

  return (
    <div className="page-shell">
      <section className="hero-section">
        <div className="hero-copy">
          <span className="eyebrow">Recon Workspace</span>
          <h1>Reconcile statements. Track exceptions. Close faster.</h1>
          <p className="hero-text">
            A reconciliation workspace for bookkeepers and finance teams who are tired of managing
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
        <div className="hero-card">
          <div className="hero-card-header">
            <Sparkles size={18} />
            <span>Month-end summary</span>
          </div>
          <div className="hero-stat-grid">
            <div>
              <strong>{stats.total}</strong>
              <span>transactions</span>
            </div>
            <div>
              <strong>{stats.unresolved}</strong>
              <span>unresolved</span>
            </div>
            <div>
              <strong>{stats.missingDocs}</strong>
              <span>missing docs</span>
            </div>
            <div>
              <strong>{stats.exceptions}</strong>
              <span>exceptions</span>
            </div>
          </div>
          <p>
            Biggest blockers this month: missing travel receipts, payout variances, and unexplained cash movement.
          </p>
        </div>
      </section>

      <section className="docs-strip" id="docs">
        <div className="doc-card">
          <FolderOpen size={18} />
          <div>
            <h3>Docs included</h3>
            <p>vision, MVP scope, GTM outline, and architecture notes are committed in <code>/docs</code>.</p>
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
            <span className="eyebrow">Interactive demo</span>
            <h2>Sample reconciliation workspace</h2>
          </div>
          <div className="toolbar">
            <button className="toolbar-pill"><Search size={15} /> Search transactions</button>
            <button className="toolbar-pill"><Filter size={15} /> Filters</button>
          </div>
        </div>

        <div className="workspace-grid">
          <aside className="panel sidebar">
            <h3>Status views</h3>
            <button className={selectedStatus === 'all' ? 'status-link active' : 'status-link'} onClick={() => setSelectedStatus('all')}>
              All items <span>{transactions.length}</span>
            </button>
            {statusOrder.map((status) => (
              <button
                key={status}
                className={selectedStatus === status ? 'status-link active' : 'status-link'}
                onClick={() => setSelectedStatus(status)}
              >
                <span className={`dot ${statusTone[status]}`} />
                {status}
                <span>{transactions.filter((t) => t.status === status).length}</span>
              </button>
            ))}
            <div className="sidebar-note">
              <Clock3 size={16} />
              <p>Most teams waste time on unresolved items, not the easy matches.</p>
            </div>
          </aside>

          <div className="panel table-panel">
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
              <h4>Bookkeeper note</h4>
              <p>{selected.note}</p>
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
          <h3>Built for validation</h3>
          <p>This first release is a believable front-end demo for interviews, iteration, and eventual Vercel deployment.</p>
        </div>
      </section>
    </div>
  )
}

export default App
