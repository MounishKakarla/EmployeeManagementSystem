// src/pages/TimesheetPage.jsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { timesheetAPI } from '../api'
import { parseApiError } from '../utils/errorUtils'
import { formatDate } from '../utils/dateUtils'
import useDocumentTitle from '../hooks/useDocumentTitle'
import Pagination from '../components/ui/Pagination'
import TimesheetEntryForm from '../components/timesheet/TimesheetEntryForm'
import { Timer, Users, CheckSquare, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import '../styles/timesheet.css'

const STATUS_BADGE = {
  DRAFT:     'badge-neutral',
  SUBMITTED: 'badge-warning',
  APPROVED:  'badge-success',
  REJECTED:  'badge-danger',
}

const TABS = [
  { key: 'my',     label: 'My Timesheets', icon: Timer  },
  { key: 'team',   label: 'Team Review',   icon: Users, adminOnly: true },
]

const PAGE_SIZE = 10

export default function TimesheetPage() {
  const { isAdmin, isManager, user } = useAuth()
  useDocumentTitle('Timesheets | Tektalis EMS')
  const qc = useQueryClient()
  const canManage = isAdmin() || isManager()

  const [activeTab,   setActiveTab]   = useState('my')
  const [myPage,      setMyPage]      = useState(0)
  const [teamPage,    setTeamPage]    = useState(0)
  const [teamEmpId,   setTeamEmpId]   = useState('')
  const [teamStatus,  setTeamStatus]  = useState('')

  // Selected date to determine the week (defaults to today)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])

  // ── Week data fetching ──────────────────────────────────────────────────────
  const { data: weekData, refetch: refetchWeek } = useQuery({
    queryKey: ['timesheet', 'week', selectedDate],
    queryFn: () => timesheetAPI.getWeek(selectedDate),
  })
  const currentWeekEntries = weekData?.data || []

  // ── My history ─────────────────────────────────────────────────────────────
  const { data: myData, isLoading: myLoading } = useQuery({
    queryKey: ['timesheet', 'my', myPage],
    queryFn: () => timesheetAPI.getMyTimesheets({ page: myPage, size: PAGE_SIZE }),
    enabled: activeTab === 'my',
  })

  // ── Team ───────────────────────────────────────────────────────────────────
  const { data: teamData, isLoading: teamLoading } = useQuery({
    queryKey: ['timesheet', 'team', teamPage, teamEmpId, teamStatus],
    queryFn: () => timesheetAPI.getTeam(teamEmpId || undefined, teamStatus || undefined,
                                        { page: teamPage, size: PAGE_SIZE }),
    enabled: activeTab === 'team' && canManage,
  })

  // ── Mutations ──────────────────────────────────────────────────────────────
  const submitMutation = useMutation({
    mutationFn: (weekStartDate) => timesheetAPI.submitWeek(weekStartDate),
    onSuccess: () => {
      toast.success('Timesheet submitted for approval!')
      qc.invalidateQueries({ queryKey: ['timesheet'] })
    },
    onError: (err) => toast.error(parseApiError(err, 'Submission failed')),
  })

  const reviewMutation = useMutation({
    mutationFn: ({ id, action }) => timesheetAPI.review(id, action, null),
    onSuccess: (_, { action }) => {
      toast.success(`Timesheet ${action === 'APPROVED' ? 'approved' : 'rejected'}`)
      qc.invalidateQueries({ queryKey: ['timesheet'] })
    },
    onError: (err) => toast.error(parseApiError(err, 'Review failed')),
  })

  const myHistory    = myData?.data?.content   || []
  const myTotalPages = myData?.data?.totalPages || 0
  const teamHistory  = teamData?.data?.content  || []
  const teamPages    = teamData?.data?.totalPages || 0

  // Calculate Monday of the selected week
  const selDate = new Date(selectedDate)
  const monday  = new Date(selDate)
  monday.setDate(selDate.getDate() - ((selDate.getDay() + 6) % 7))
  const weekStartDate = monday.toISOString().split('T')[0]

  const changeWeek = (offset) => {
    const d = new Date(weekStartDate)
    d.setDate(d.getDate() + (offset * 7))
    setSelectedDate(d.toISOString().split('T')[0])
  }

  const weekSubmitted = currentWeekEntries.some(
    e => e.status === 'SUBMITTED' || e.status === 'APPROVED')

  const visibleTabs = TABS.filter(t => !t.adminOnly || canManage)

  return (
    <div className="timesheet-page">
      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Timer size={26} color="var(--accent)" /> Timesheets
          </h1>
          <p className="page-subtitle">Log your weekly hours and track approvals</p>
        </div>
        {/* Status pill — shows current week submission state */}
        {currentWeekEntries.length > 0 && (() => {
          const s = currentWeekEntries[0].status || 'DRAFT'
          return (
            <div className={`timesheet-status-pill ${
              s === 'APPROVED' ? 'ts-approved' : s === 'SUBMITTED' ? 'ts-submitted' : s === 'REJECTED' ? 'ts-rejected' : 'ts-draft'
            }`}>{s}</div>
          )
        })()}
      </div>

      {/* ── Weekly banner ─────────────────────────────────────────────────────── */}
      <div className="timesheet-week-banner" style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 10, marginRight: 20 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => changeWeek(-1)} title="Previous Week">
            <ChevronLeft size={16} />
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])} title="Current Week">
            Current
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => changeWeek(1)} title="Next Week">
            <ChevronRight size={16} />
          </button>
        </div>
        
        <Timer size={15} color="var(--accent)" />
        <span className="timesheet-week-range" style={{ marginLeft: 8 }}>
          Week: {formatDate(weekStartDate)} →{' '}
          {formatDate(new Date(new Date(weekStartDate).getTime() + 6*24*60*60*1000).toISOString().split('T')[0])}
        </span>
        <span className="timesheet-week-hours">
          {currentWeekEntries.reduce((s, e) => s + (
            (e.mondayHours||0)+(e.tuesdayHours||0)+(e.wednesdayHours||0)+
            (e.thursdayHours||0)+(e.fridayHours||0)+(e.saturdayHours||0)+(e.sundayHours||0)
          ), 0).toFixed(1)}h total
        </span>
      </div>

      {/* ── Current week entry form ───────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 className="card-title">
             Week of {formatDate(weekStartDate)}
          </h3>
          {!weekSubmitted && (
            <button className="btn btn-primary btn-sm"
              onClick={() => submitMutation.mutate(weekStartDate)}
              disabled={submitMutation.isPending || currentWeekEntries.length === 0}>
              {submitMutation.isPending
                ? <><span className="spinner" style={{ width: 13, height: 13 }} /> Submitting…</>
                : <><CheckSquare size={14} /> Submit Week</>}
            </button>
          )}
          {weekSubmitted && (
            <span className="badge badge-success">Week Submitted</span>
          )}
        </div>
        <TimesheetEntryForm
          weekStartDate={weekStartDate}
          existingEntries={currentWeekEntries}
          disabled={weekSubmitted}
          onSaved={() => qc.invalidateQueries({ queryKey: ['timesheet'] })}
        />
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────────── */}
      <div className="timesheet-tabs">
        {visibleTabs.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`timesheet-tab-btn ${activeTab === key ? 'active' : ''}`}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* ── My History ───────────────────────────────────────────────────────── */}
      {activeTab === 'my' && (
        <TimesheetTable records={myHistory} isLoading={myLoading}
          showEmployee={false}
          page={myPage} totalPages={myTotalPages} onPageChange={setMyPage} />
      )}

      {/* ── Team Review ───────────────────────────────────────────────────────── */}
      {activeTab === 'team' && canManage && (
        <div>
          <div className="card card-sm" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <label className="form-label">Employee ID</label>
                <input className="form-input" placeholder="TT0001…" value={teamEmpId}
                  style={{ width: 140 }}
                  onChange={e => { setTeamEmpId(e.target.value); setTeamPage(0) }} />
              </div>
              <div>
                <label className="form-label">Status</label>
                <select className="form-select" value={teamStatus} style={{ width: 140 }}
                  onChange={e => { setTeamStatus(e.target.value); setTeamPage(0) }}>
                  <option value="">All</option>
                  {['DRAFT','SUBMITTED','APPROVED','REJECTED'].map(s =>
                    <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {(teamEmpId || teamStatus) && (
                <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-end' }}
                  onClick={() => { setTeamEmpId(''); setTeamStatus(''); }}>Clear</button>
              )}
            </div>
          </div>
          <TimesheetTable records={teamHistory} isLoading={teamLoading}
            showEmployee={true}
            actions={(r) => {
              if (r.status !== 'SUBMITTED') return null
              // Self-approval prevention: cannot review your own timesheet
              const isSelf = r.empId === user?.empId
              if (isSelf) return (
                <span style={{ fontSize: 11, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  Must be reviewed by another Admin/Manager
                </span>
              )
              return (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-primary btn-sm"
                    onClick={() => reviewMutation.mutate({ id: r.id, action: 'APPROVED' })}
                    disabled={reviewMutation.isPending}>Approve</button>
                  <button className="btn btn-danger btn-sm"
                    onClick={() => reviewMutation.mutate({ id: r.id, action: 'REJECTED' })}
                    disabled={reviewMutation.isPending}>Reject</button>
                </div>
              )
            }}
            page={teamPage} totalPages={teamPages} onPageChange={setTeamPage} />
        </div>
      )}
    </div>
  )
}

// ── Shared table ───────────────────────────────────────────────────────────────
function TimesheetTable({ records, isLoading, showEmployee, actions, page, totalPages, onPageChange }) {
  if (isLoading) return (
    <div style={{ padding: 60, display: 'flex', justifyContent: 'center' }}>
      <div className="spinner" style={{ width: 28, height: 28 }} />
    </div>
  )
  if (!records.length) return (
    <div className="empty-state card"><Timer size={36} /><h3>No timesheet entries found</h3></div>
  )
  return (
    <div className="card" style={{ padding: 0 }}>
      <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
        <table>
          <thead>
            <tr>
              {showEmployee && <th>Employee</th>}
              <th>Week</th><th>Project</th><th>Total Hours</th>
              <th>Status</th><th>Submitted</th>
              {actions && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {records.map(r => (
              <tr key={r.id}>
                {showEmployee && (
                  <td>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{r.employeeName}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.empId}</div>
                  </td>
                )}
                <td style={{ fontSize: 13 }}>{formatDate(r.weekStartDate)}</td>
                <td style={{ fontSize: 13, fontWeight: 500 }}>{r.project}</td>
                <td style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>
                  {r.totalHours ?? 0}h
                </td>
                <td><span className={`badge ${STATUS_BADGE[r.status] ?? 'badge-neutral'}`}
                  style={{ fontSize: 11 }}>{r.status}</span></td>
                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {r.submittedAt ? formatDate(r.submittedAt) : '—'}
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