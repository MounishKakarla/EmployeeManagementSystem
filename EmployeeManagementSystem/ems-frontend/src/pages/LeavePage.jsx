// src/pages/LeavePage.jsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { leaveAPI } from '../api'
import { parseApiError } from '../utils/errorUtils'
import { formatDate } from '../utils/dateUtils'
import useDocumentTitle from '../hooks/useDocumentTitle'
import LeaveBalanceCards from '../components/leave/LeaveBalanceCards'
import RequestLeaveModal from '../components/leave/RequestLeaveModal'
import GrantLeaveModal from '../components/leave/GrantLeaveModal'
import Pagination from '../components/ui/Pagination'
import { Umbrella, ClipboardList, CheckCircle, XCircle, Clock, AlertCircle, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import '../styles/leave.css'

const STATUS_BADGE = {
  PENDING:   'badge-warning',
  APPROVED:  'badge-success',
  REJECTED:  'badge-danger',
  CANCELLED: 'badge-neutral',
}

const LEAVE_TYPE_COLORS = {
  ANNUAL:        'badge-info',
  SICK:          'badge-danger',
  CASUAL:        'badge-accent',
  SICK_CASUAL:   'badge-danger',
  UNPAID:        'badge-neutral',
  MATERNITY:     'badge-success',
  PATERNITY:     'badge-success',
  COMPENSATORY:  'badge-warning',
}

const TABS = [
  { key: 'my',      label: 'My Leaves',     icon: Umbrella },
  { key: 'pending', label: 'Pending Review', icon: Clock,          adminOnly: true },
  { key: 'all',     label: 'All Requests',   icon: ClipboardList,  adminOnly: true },
]

const PAGE_SIZE = 10

export default function LeavePage() {
  const { user, isAdmin, isManager } = useAuth()
  useDocumentTitle('Leave Requests | TekSphere')
  const qc = useQueryClient()
  const canManage = isAdmin() || isManager()

  const [activeTab,    setActiveTab]    = useState('my')
  const [requestOpen,  setRequestOpen]  = useState(false)
  const [grantOpen,    setGrantOpen]    = useState(false)
  const [myPage,       setMyPage]       = useState(0)
  const [pendingPage,  setPendingPage]  = useState(0)
  const [allPage,      setAllPage]      = useState(0)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterEmpId,  setFilterEmpId]  = useState('')

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: balanceData } = useQuery({
    queryKey: ['leave', 'balance'],
    queryFn: () => leaveAPI.getMyBalance(),
  })

  const { data: myData, isLoading: myLoading } = useQuery({
    queryKey: ['leave', 'my', myPage],
    queryFn: () => leaveAPI.getMyLeaves({ page: myPage, size: PAGE_SIZE }),
    enabled: activeTab === 'my',
  })

  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: ['leave', 'pending', pendingPage],
    queryFn: () => leaveAPI.getPending({ page: pendingPage, size: PAGE_SIZE }),
    enabled: activeTab === 'pending' && canManage,
  })

  const { data: allData, isLoading: allLoading } = useQuery({
    queryKey: ['leave', 'all', allPage, filterEmpId, filterStatus],
    queryFn: () => leaveAPI.getAll(filterEmpId || undefined, filterStatus || undefined,
                                   { page: allPage, size: PAGE_SIZE }),
    enabled: activeTab === 'all' && canManage,
  })

  // ── Mutations ──────────────────────────────────────────────────────────────
  const cancelMutation = useMutation({
    mutationFn: (id) => leaveAPI.cancel(id),
    onSuccess: () => { toast.success('Leave request cancelled'); qc.invalidateQueries({ queryKey: ['leave'] }) },
    onError: (err) => toast.error(parseApiError(err, 'Failed to cancel')),
  })

  const reviewMutation = useMutation({
    mutationFn: ({ id, action, notes }) => leaveAPI.review(id, action, notes),
    onSuccess: (_, { action }) => {
      toast.success(`Leave ${action === 'APPROVED' ? 'approved' : 'rejected'}`)
      qc.invalidateQueries({ queryKey: ['leave'] })
    },
    onError: (err) => toast.error(parseApiError(err, 'Failed to review')),
  })

  const balance    = balanceData?.data
  const myLeaves   = myData?.data?.content || []
  const myTotal    = myData?.data?.totalPages || 0
  const pending    = pendingData?.data?.content || []
  const pendTotal  = pendingData?.data?.totalPages || 0
  const allLeaves  = allData?.data?.content || []
  const allTotal   = allData?.data?.totalPages || 0

  const visibleTabs = TABS.filter(t => !t.adminOnly || canManage)

  return (
    <div className="leave-page">
      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Umbrella size={26} color="var(--accent)" /> Leave Management
          </h1>
          <p className="page-subtitle">Apply for leave and track your requests</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {isAdmin() && (
            <button className="btn btn-secondary" onClick={() => setGrantOpen(true)}>
              Grant Leave
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setRequestOpen(true)}>
            + Request Leave
          </button>
        </div>
      </div>

      {/* ── Balance cards ────────────────────────────────────────────────────── */}
      <LeaveBalanceCards balance={balance} />

      {/* ── Tabs ─────────────────────────────────────────────────────────────── */}
      <div className="leave-tabs">
        {visibleTabs.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`leave-tab-btn ${activeTab === key ? 'active' : ''}`}>
            <Icon size={15} /> {label}
            {key === 'pending' && pending.length > 0 && (
              <span className="leave-badge-count">{pendingData?.data?.totalElements}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── My Leaves tab ────────────────────────────────────────────────────── */}
      {activeTab === 'my' && (
        <LeaveTable
          records={myLeaves} isLoading={myLoading}
          showEmployee={false}
          actions={(r) => r.status === 'PENDING' && (
            <button className="btn btn-ghost btn-sm"
              onClick={() => cancelMutation.mutate(r.id)}
              disabled={cancelMutation.isPending}>
              Cancel
            </button>
          )}
          page={myPage} totalPages={myTotal} onPageChange={setMyPage}
        />
      )}

      {/* ── Pending Review tab ───────────────────────────────────────────────── */}
      {activeTab === 'pending' && canManage && (
        <LeaveTable
          records={pending} isLoading={pendingLoading}
          showEmployee={true}
          actions={(r) => {
            // Self-approval prevention: an admin/manager cannot review their own leave
            const isSelf = r.empId === user?.empId
            if (isSelf) return (
              <span style={{ fontSize: 12, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertCircle size={13} /> Must be reviewed by another Admin/Manager
              </span>
            )
            return (
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-primary btn-sm"
                  onClick={() => reviewMutation.mutate({ id: r.id, action: 'APPROVED' })}
                  disabled={reviewMutation.isPending}>
                  <CheckCircle size={13} /> Approve
                </button>
                <button className="btn btn-danger btn-sm"
                  onClick={() => reviewMutation.mutate({ id: r.id, action: 'REJECTED' })}
                  disabled={reviewMutation.isPending}>
                  <XCircle size={13} /> Reject
                </button>
              </div>
            )
          }}
          page={pendingPage} totalPages={pendTotal} onPageChange={setPendingPage}
        />
      )}

      {/* ── All Requests tab ─────────────────────────────────────────────────── */}
      {activeTab === 'all' && canManage && (
        <div>
          <div className="card card-sm" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <label className="form-label">Employee ID</label>
                <input className="form-input" placeholder="TT0001…" value={filterEmpId}
                  style={{ width: 140 }}
                  onChange={e => { setFilterEmpId(e.target.value); setAllPage(0) }} />
              </div>
              <div>
                <label className="form-label">Status</label>
                <select className="form-select" value={filterStatus}
                  style={{ width: 140 }}
                  onChange={e => { setFilterStatus(e.target.value); setAllPage(0) }}>
                  <option value="">All</option>
                  {['PENDING','APPROVED','REJECTED','CANCELLED'].map(s =>
                    <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {(filterEmpId || filterStatus) && (
                <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-end' }}
                  onClick={() => { setFilterEmpId(''); setFilterStatus(''); setAllPage(0) }}>
                  Clear
                </button>
              )}
            </div>
          </div>
          <LeaveTable
            records={allLeaves} isLoading={allLoading} showEmployee={true}
            page={allPage} totalPages={allTotal} onPageChange={setAllPage}
          />
        </div>
      )}

      <RequestLeaveModal
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        balance={balance}
        onSuccess={() => qc.invalidateQueries({ queryKey: ['leave'] })}
      />

      <GrantLeaveModal
        open={grantOpen}
        onClose={() => setGrantOpen(false)}
        onSuccess={() => qc.invalidateQueries({ queryKey: ['leave'] })}
      />
    </div>
  )
}

// ── Shared table ───────────────────────────────────────────────────────────────
function LeaveTable({ records, isLoading, showEmployee, actions, page, totalPages, onPageChange }) {
  if (isLoading) return (
    <div style={{ padding: 60, display: 'flex', justifyContent: 'center' }}>
      <div className="spinner" style={{ width: 28, height: 28 }} />
    </div>
  )
  if (!records.length) return (
    <div className="empty-state card">
      <Umbrella size={36} />
      <h3>No leave requests found</h3>
    </div>
  )
  return (
    <div className="card" style={{ padding: 0 }}>
      <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
        <table>
          <thead>
            <tr>
              {showEmployee && <th>Employee</th>}
              <th>Type</th><th>From</th><th>To</th>
              <th>Days</th><th>Status</th><th>Reason</th>
              {actions && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {records.map(r => (
              <tr key={r.id}>
                {showEmployee && (
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {r.profileImage ? (
                        <img src={r.profileImage} alt={r.employeeName} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)' }} />
                      ) : (
                        <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
                          {r.employeeName?.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase() || '??'}
                        </div>
                      )}
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{r.employeeName}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.empId}</div>
                      </div>
                    </div>
                  </td>
                )}
                <td><span className={`badge ${LEAVE_TYPE_COLORS[r.leaveType] ?? 'badge-neutral'}`}
                  style={{ fontSize: 11 }}>{r.leaveType}</span></td>
                <td style={{ fontSize: 13 }}>{formatDate(r.startDate)}</td>
                <td style={{ fontSize: 13 }}>{formatDate(r.endDate)}</td>
                <td style={{ fontSize: 13, fontWeight: 600 }}>{r.daysRequested}</td>
                <td><span className={`badge ${STATUS_BADGE[r.status] ?? 'badge-neutral'}`}
                  style={{ fontSize: 11 }}>{r.status}</span></td>
                <td style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 160,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.reason || '—'}
                </td>
                {actions && <td>{actions(r)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="pagination-bar">
          <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
        </div>
      )}
    </div>
  )
}