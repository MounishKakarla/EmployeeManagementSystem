// src/pages/AuditLogPage.jsx  — ADMIN only
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { auditAPI } from '../api'
import { parseApiError } from '../utils/errorUtils'
import Pagination from '../components/ui/Pagination'
import useDocumentTitle from '../hooks/useDocumentTitle'
import { ShieldAlert, Search, RefreshCw, AlertCircle } from 'lucide-react'
import '../styles/auditlog.css'

const PAGE_SIZE = 20

const ACTION_COLORS = {
  CREATE:   { bg: 'var(--success-light)', color: 'var(--success)' },
  UPDATE:   { bg: 'var(--info-light)',    color: 'var(--info)'    },
  DELETE:   { bg: 'var(--danger-light)',  color: 'var(--danger)'  },
  LOGIN:    { bg: 'var(--accent-light)',  color: 'var(--accent)'  },
  LOGOUT:   { bg: 'var(--bg-tertiary)',   color: 'var(--text-muted)' },
  ASSIGN:   { bg: 'var(--warning-light)', color: 'var(--warning)' },
  RESET:    { bg: 'var(--warning-light)', color: 'var(--warning)' },
  APPROVE:  { bg: 'var(--success-light)', color: 'var(--success)' },
  REJECT:   { bg: 'var(--danger-light)',  color: 'var(--danger)'  },
  IMPORT:   { bg: 'var(--info-light)',    color: 'var(--info)'    },
}

function getActionColor(action = '') {
  const key = Object.keys(ACTION_COLORS).find(k => action.toUpperCase().includes(k))
  return key ? ACTION_COLORS[key] : { bg: 'var(--bg-tertiary)', color: 'var(--text-muted)' }
}

function formatDateTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function AuditLogPage() {
  useDocumentTitle('Audit Log | Tektalis EMS')
  const [page,         setPage]         = useState(0)
  const [searchUser,   setSearchUser]   = useState('')
  const [searchAction, setSearchAction] = useState('')
  const [searchTarget, setSearchTarget] = useState('')
  const [applied,      setApplied]      = useState({ user: '', action: '', target: '' })

  const hasFilter = applied.user || applied.action || applied.target

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['audit', 'logs', page, applied],
    queryFn: () => hasFilter
      ? auditAPI.searchLogs(applied.user || undefined, applied.action || undefined,
                            applied.target || undefined, { page, size: PAGE_SIZE })
      : auditAPI.getLogs({ page, size: PAGE_SIZE }),
  })

  const logs       = data?.data?.content || []
  const totalPages = data?.data?.totalPages || 0
  const totalCount = data?.data?.totalElements || 0

  const applyFilters = () => {
    setApplied({ user: searchUser, action: searchAction, target: searchTarget })
    setPage(0)
  }

  const clearFilters = () => {
    setSearchUser(''); setSearchAction(''); setSearchTarget('')
    setApplied({ user: '', action: '', target: '' })
    setPage(0)
  }

  return (
    <div className="auditlog-page">
      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShieldAlert size={26} color="var(--accent)" /> Audit Logs
          </h1>
          <p className="page-subtitle">
            {isLoading ? 'Loading…' : `${totalCount.toLocaleString()} total events recorded`}
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => refetch()}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* ── Filter bar ───────────────────────────────────────────────────────── */}
      <div className="card card-sm" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 140px' }}>
            <label className="form-label">Employee ID</label>
            <div className="search-box">
              <Search size={14} />
              <input className="form-input" placeholder="TT0001…"
                value={searchUser} onChange={e => setSearchUser(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && applyFilters()} />
            </div>
          </div>
          <div style={{ flex: '1 1 140px' }}>
            <label className="form-label">Action keyword</label>
            <input className="form-input" placeholder="e.g. CREATE, DELETE…"
              value={searchAction} onChange={e => setSearchAction(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applyFilters()} />
          </div>
          <div style={{ flex: '1 1 140px' }}>
            <label className="form-label">Target keyword</label>
            <input className="form-input" placeholder="e.g. Employee, TT0001…"
              value={searchTarget} onChange={e => setSearchTarget(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applyFilters()} />
          </div>
          <div style={{ display: 'flex', gap: 8, alignSelf: 'flex-end' }}>
            <button className="btn btn-primary btn-sm" onClick={applyFilters}>
              <Search size={13} /> Search
            </button>
            {hasFilter && (
              <button className="btn btn-ghost btn-sm" onClick={clearFilters}>Clear</button>
            )}
          </div>
        </div>
      </div>

      {/* ── Error ────────────────────────────────────────────────────────────── */}
      {error && (
        <div className="error-banner" style={{ marginBottom: 16 }}>
          <AlertCircle size={16} />
          {parseApiError(error, 'Failed to load audit logs')}
        </div>
      )}

      {/* ── Table ────────────────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 0 }}>
        {isLoading ? (
          <div style={{ padding: 60, display: 'flex', justifyContent: 'center' }}>
            <div className="spinner" style={{ width: 28, height: 28 }} />
          </div>
        ) : logs.length === 0 ? (
          <div className="empty-state">
            <ShieldAlert size={36} />
            <h3>No audit logs found</h3>
            <p style={{ fontSize: 14 }}>Try adjusting your search filters.</p>
          </div>
        ) : (
          <>
            <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 60 }}>#</th>
                    <th>Employee</th>
                    <th>Action</th>
                    <th>Target</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, i) => {
                    const ac = getActionColor(log.action)
                    return (
                      <tr key={log.id}>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)',
                          fontFamily: 'var(--font-mono)' }}>{log.id}</td>
                        <td>
                          <span style={{
                            fontFamily: 'var(--font-display)', fontWeight: 600,
                            fontSize: 13, color: 'var(--accent)',
                          }}>{log.user}</span>
                        </td>
                        <td>
                          <span style={{
                            background: ac.bg, color: ac.color,
                            padding: '3px 10px', borderRadius: 100,
                            fontSize: 12, fontWeight: 600,
                            display: 'inline-block',
                          }}>
                            {log.action}
                          </span>
                        </td>
                        <td style={{
                          fontSize: 13, color: 'var(--text-secondary)',
                          maxWidth: 240, overflow: 'hidden',
                          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {log.target}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {formatDateTime(log.createdAt)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="pagination-bar">
              <span className="pagination-info">
                Showing {Math.min(page * PAGE_SIZE + 1, totalCount)}–
                {Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}
              </span>
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
              <span className="pagination-info">
                Page {page + 1} of {Math.max(1, totalPages)}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
