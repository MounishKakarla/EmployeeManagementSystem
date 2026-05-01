// src/pages/TimesheetPage.jsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { timesheetAPI, leaveAPI } from '../api'
import { parseApiError } from '../utils/errorUtils'
import { formatDate, formatWeek, firstWorkedDate } from '../utils/dateUtils'
import useDocumentTitle from '../hooks/useDocumentTitle'
import Pagination from '../components/ui/Pagination'
import TimesheetEntryForm from '../components/timesheet/TimesheetEntryForm'
import { Timer, Users, CheckSquare, ChevronLeft, ChevronRight, Download } from 'lucide-react'
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
  useDocumentTitle('Timesheets | TekSphere')
  const qc = useQueryClient()
  const canManage = isAdmin() || isManager()

  const [activeTab,   setActiveTab]   = useState('my')
  const [myPage,      setMyPage]      = useState(0)
  const [teamPage,    setTeamPage]    = useState(0)
  const [teamEmpId,   setTeamEmpId]   = useState('')
  const [teamStatus,  setTeamStatus]  = useState('')
  const [myFrom,      setMyFrom]      = useState('')
  const [myTo,        setMyTo]        = useState('')
  const [teamFrom,    setTeamFrom]    = useState('')
  const [teamTo,      setTeamTo]      = useState('')

  // Selected date to determine the week (defaults to today)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])

  // ── Week data ──────────────────────────────────────────────────────────────
  const { data: weekData } = useQuery({
    queryKey: ['timesheet', 'week', selectedDate],
    queryFn: () => timesheetAPI.getWeek(selectedDate),
  })
  const currentWeekEntries = weekData?.data || []

  // Normalize any date to the Monday of its ISO week so the backend's
  // weekStartDate comparisons always include the correct week.
  const toWeekStart = (dateStr) => {
    if (!dateStr) return dateStr
    const d = new Date(dateStr + 'T12:00:00')
    const day = d.getDay() // 0=Sun … 6=Sat
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
    return d.toISOString().split('T')[0]
  }

  // ── My history ─────────────────────────────────────────────────────────────
  const { data: myData, isLoading: myLoading, isFetching: myFetching } = useQuery({
    queryKey: ['timesheet', 'my', myPage, myFrom, myTo],
    queryFn: () => timesheetAPI.getMyTimesheets({
      page: myPage, size: PAGE_SIZE,
      ...(myFrom && { from: toWeekStart(myFrom) }),
      ...(myTo   && { to: myTo }),
    }),
    enabled: activeTab === 'my',
  })

  // ── Team ───────────────────────────────────────────────────────────────────
  const { data: teamData, isLoading: teamLoading, isFetching: teamFetching } = useQuery({
    queryKey: ['timesheet', 'team', teamPage, teamEmpId, teamStatus, teamFrom, teamTo],
    queryFn: () => timesheetAPI.getTeam(teamEmpId || undefined, teamStatus || undefined, {
      page: teamPage, size: PAGE_SIZE,
      ...(teamFrom && { from: toWeekStart(teamFrom) }),
      ...(teamTo   && { to: teamTo }),
    }),
    enabled: activeTab === 'team' && canManage,
  })

  // ── Approved leaves for weekly target ──────────────────────────────────────
  const { data: leaveData } = useQuery({
    queryKey: ['leaves', 'approved-all'],
    queryFn: () => leaveAPI.getMyLeaves({ status: 'APPROVED', size: 100 }),
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

  const TS_DAY_KEYS = ['mondayHours','tuesdayHours','wednesdayHours','thursdayHours','fridayHours','saturdayHours','sundayHours']
  const hasHoursInRange = (entry, from, to) => {
    if (!from && !to) return true
    const ws = new Date(entry.weekStartDate + 'T12:00:00')
    for (let i = 0; i < TS_DAY_KEYS.length; i++) {
      if ((entry[TS_DAY_KEYS[i]] || 0) > 0) {
        const d = new Date(ws); d.setDate(ws.getDate() + i)
        const ds = d.toISOString().split('T')[0]
        if ((!from || ds >= from) && (!to || ds <= to)) return true
      }
    }
    return false
  }

  const myHistory    = (myData?.data?.content   || []).filter(r => hasHoursInRange(r, myFrom, myTo))
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

  const weekApproved = currentWeekEntries.some(e => e.status === 'APPROVED')
  const weekInReview = !weekApproved && currentWeekEntries.some(e => e.status === 'SUBMITTED')
  const hasDraft     = currentWeekEntries.some(e => e.status === 'DRAFT')

  // ── Weekly hours progress ──────────────────────────────────────────────────
  const totalH = currentWeekEntries.reduce((s, e) => s + (
    (e.mondayHours||0)+(e.tuesdayHours||0)+(e.wednesdayHours||0)+
    (e.thursdayHours||0)+(e.fridayHours||0)+(e.saturdayHours||0)+(e.sundayHours||0)
  ), 0)

  const myLeaves = leaveData?.data?.content || []
  const leaveWorkdays = myLeaves.reduce((count, leave) => {
    for (let d = 0; d < 5; d++) {
      const wd = new Date(new Date(weekStartDate).getTime() + d * 24 * 60 * 60 * 1000)
                   .toISOString().split('T')[0]
      if (leave.startDate && leave.endDate && wd >= leave.startDate && wd <= leave.endDate) count++
    }
    return count
  }, 0)
  const weekGreeting =
    totalH === 0 ? null
    : totalH < 8  ? { text: 'Good start! Every hour counts.', color: 'var(--warning)' }
    : totalH < 16 ? { text: 'Making progress! Keep it up.', color: 'var(--accent)' }
    : totalH < 24 ? { text: 'Great work! Building momentum.', color: 'var(--accent)' }
    : totalH < 32 ? { text: "Solid week! You're doing great.", color: 'var(--success)' }
    : totalH < 40 ? { text: 'Finishing strong! Almost there.', color: 'var(--success)' }
    : { text: 'Outstanding week! Great dedication.', color: 'var(--success)' }
  const activityPct = Math.min(100, (totalH / 40) * 100)
  const barColor    = totalH === 0 ? 'var(--bg-tertiary)' : totalH < 16 ? 'var(--warning)' : totalH < 32 ? 'var(--accent)' : 'var(--success)'

  const visibleTabs = TABS.filter(t => !t.adminOnly || canManage)

  const exportWeekPDF = () => {
    const DAYS_FULL = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
    const HOURS_KEYS = ['mondayHours','tuesdayHours','wednesdayHours','thursdayHours','fridayHours','saturdayHours','sundayHours']
    const weekEndDate = new Date(new Date(weekStartDate).getTime() + 6*24*60*60*1000).toISOString().split('T')[0]
    const emp = currentWeekEntries[0]
    const empId = emp?.empId || user?.empId || 'EMP'

    const to12h = (t) => {
      if (!t) return '—'
      const [h, m] = t.split(':').map(Number)
      const period = h >= 12 ? 'PM' : 'AM'
      return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${period}`
    }

    const rows = []
    currentWeekEntries.forEach(e => {
      HOURS_KEYS.forEach((k, i) => {
        const h = parseFloat(e[k]) || 0
        if (h > 0) {
          const timeRange = e.startTime && e.endTime
            ? `${to12h(e.startTime)} – ${to12h(e.endTime)}`
            : e.startTime ? `From ${to12h(e.startTime)}` : '—'
          rows.push({ day: DAYS_FULL[i], project: e.project, task: e.taskDescription || '—',
            timeRange, hours: h, status: e.status })
        }
      })
    })

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Timesheet — ${empId} — ${weekStartDate}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;padding:36px;color:#111;font-size:13px}
  h1{font-size:20px;margin-bottom:6px;color:#1a1a2e}
  .meta{color:#555;font-size:12px;margin-bottom:28px;line-height:1.8}
  .meta strong{color:#111}
  table{width:100%;border-collapse:collapse;margin-bottom:20px}
  th{background:#f4f4f8;padding:9px 12px;text-align:left;border:1px solid #ddd;font-size:12px;text-transform:uppercase;letter-spacing:.5px}
  td{padding:8px 12px;border:1px solid #e0e0e0;vertical-align:top}
  tr:nth-child(even) td{background:#fafafa}
  .badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700}
  .DRAFT{background:#eee;color:#555}.SUBMITTED{background:#fff3cd;color:#856404}
  .APPROVED{background:#d4edda;color:#155724}.REJECTED{background:#f8d7da;color:#721c24}
  .total{text-align:right;font-size:14px;font-weight:bold;color:#333;margin-top:4px}
  .progress{height:10px;border-radius:5px;background:#e9ecef;overflow:hidden;margin-bottom:4px}
  .progress-fill{height:100%;border-radius:5px;background:#4361ee}
  .footer{margin-top:36px;font-size:10px;color:#aaa;border-top:1px solid #eee;padding-top:12px}
  .time-cell{font-size:12px;color:#444;white-space:nowrap}
  @media print{body{padding:16px}button{display:none}}
</style></head><body>
<h1>Timesheet Report</h1>
<div class="meta">
  <strong>Employee:</strong> ${emp?.employeeName || user?.name || '—'} (${empId})<br>
  <strong>Department:</strong> ${emp?.department || '—'}<br>
  <strong>Week:</strong> ${weekStartDate} to ${weekEndDate}<br>
  <strong>Status:</strong> ${currentWeekEntries[0]?.status || 'DRAFT'}
</div>
<table>
<thead><tr><th>Day</th><th>Project</th><th>Task Description</th><th>Time</th><th>Hours</th><th>Status</th></tr></thead>
<tbody>
${rows.length === 0
  ? '<tr><td colspan="6" style="text-align:center;color:#888;padding:20px">No entries for this week</td></tr>'
  : rows.map(r => `<tr>
      <td>${r.day}</td>
      <td><strong>${r.project}</strong></td>
      <td>${r.task}</td>
      <td class="time-cell">${r.timeRange}</td>
      <td><strong>${r.hours}h</strong></td>
      <td><span class="badge ${r.status}">${r.status}</span></td>
    </tr>`).join('')}
</tbody>
</table>
<div class="progress"><div class="progress-fill" style="width:${Math.min(100,(totalH/40)*100)}%"></div></div>
<p class="total">Total: ${totalH.toFixed(1)}h logged this week</p>
<div class="footer">Generated by TekSphere &middot; ${new Date().toLocaleString()}</div>
<script>window.onload=()=>setTimeout(()=>window.print(),400)</script>
</body></html>`

    const blob = new Blob([html], { type: 'text/html' })
    const url  = URL.createObjectURL(blob)
    const win  = window.open(url, '_blank', 'width=900,height=700')
    // Compute ISO week number for filename
    const wDate  = new Date(weekStartDate)
    const jan4   = new Date(wDate.getFullYear(), 0, 4)
    const weekNo = Math.ceil(((wDate - jan4) / 86400000 + jan4.getDay() + 1) / 7)
    const a = document.createElement('a')
    a.href = url
    a.download = `${empId}_W${weekNo}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 5000)
    if (!win) toast.error('Pop-up blocked. Please allow pop-ups to export PDF.')
  }

  // ── Team PDF Export (Admin/Manager) ───────────────────────────────────────
  const exportTeamPDF = () => {
    if (!teamHistory.length) { toast.error('No team entries to export'); return }

    const rowsHtml = teamHistory.map(r => {
      const statusBg = r.status === 'APPROVED' ? '#d4edda' : r.status === 'SUBMITTED' ? '#fff3cd' : r.status === 'REJECTED' ? '#f8d7da' : '#eee'
      const statusFg = r.status === 'APPROVED' ? '#155724' : r.status === 'SUBMITTED' ? '#856404' : r.status === 'REJECTED' ? '#721c24' : '#555'
      return `<tr>
        <td><strong>${r.employeeName || '—'}</strong><br><span style="font-size:10px;color:#888">${r.empId || ''}</span></td>
        <td>${formatDate(r.weekStartDate)}</td>
        <td><strong>${r.project || '—'}</strong></td>
        <td>${r.taskDescription || '—'}</td>
        <td style="text-align:center;font-weight:700;color:#4361ee">${r.totalHours ?? 0}h</td>
        <td style="text-align:center"><span style="background:${statusBg};color:${statusFg};padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700">${r.status}</span></td>
        <td style="font-size:11px;color:#888">${r.submittedAt ? formatDate(r.submittedAt) : '—'}</td>
      </tr>`
    }).join('')

    const filters = [
      teamEmpId && `Employee: ${teamEmpId}`,
      teamStatus && `Status: ${teamStatus}`,
      teamFrom && `From: ${teamFrom}`,
      teamTo && `To: ${teamTo}`,
    ].filter(Boolean).join(' · ') || 'All employees'

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Team Timesheets Report</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;padding:36px;color:#111;font-size:12px}
  h1{font-size:20px;margin-bottom:4px;color:#1a1a2e}
  .sub{color:#555;font-size:12px;margin-bottom:20px}
  .filters{background:#f4f4f8;padding:10px 16px;border-radius:8px;margin-bottom:20px;font-size:11px;color:#555}
  table{width:100%;border-collapse:collapse;font-size:11px}
  th{background:#4361ee;color:#fff;padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.5px}
  td{padding:7px 10px;border-bottom:1px solid #eee;vertical-align:top}
  tr:nth-child(even) td{background:#fafafa}
  .summary{margin-top:20px;font-size:13px;font-weight:700;text-align:right;color:#333}
  .footer{margin-top:28px;font-size:10px;color:#aaa;border-top:1px solid #eee;padding-top:12px}
  @media print{body{padding:16px}button{display:none}}
</style></head><body>
<h1>Team Timesheets Report</h1>
<p class="sub">Generated by ${user?.name || 'Admin'} · TekSphere</p>
<div class="filters"><strong>Filters:</strong> ${filters} · <strong>Records:</strong> ${teamHistory.length}</div>
<table>
<thead><tr><th>Employee</th><th>Week</th><th>Project</th><th>Task</th><th style="text-align:center">Hours</th><th style="text-align:center">Status</th><th>Submitted</th></tr></thead>
<tbody>${rowsHtml}</tbody>
</table>
<p class="summary">Total entries: ${teamHistory.length} · Total hours: ${teamHistory.reduce((s, r) => s + (r.totalHours ?? 0), 0).toFixed(1)}h</p>
<div class="footer">Generated by TekSphere · ${new Date().toLocaleString()}</div>
<script>window.onload=()=>setTimeout(()=>window.print(),400)</script>
</body></html>`

    const blob = new Blob([html], { type: 'text/html' })
    const url  = URL.createObjectURL(blob)
    const win  = window.open(url, '_blank', 'width=1000,height=700')
    const a = document.createElement('a')
    a.href = url
    a.download = `Team_Timesheets_${new Date().toISOString().split('T')[0]}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 5000)
    if (!win) toast.error('Pop-up blocked. Please allow pop-ups to export PDF.')
  }

  return (
    <div className="timesheet-page">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Timer size={26} color="var(--accent)" /> Timesheets
          </h1>
          <p className="page-subtitle">Log your weekly hours and track approvals</p>
        </div>
        {currentWeekEntries.length > 0 && (() => {
          const s = currentWeekEntries[0].status || 'DRAFT'
          return (
            <div className={`timesheet-status-pill ${
              s === 'APPROVED' ? 'ts-approved' : s === 'SUBMITTED' ? 'ts-submitted' : s === 'REJECTED' ? 'ts-rejected' : 'ts-draft'
            }`}>{s}</div>
          )
        })()}
      </div>

      {/* ── Weekly banner ─────────────────────────────────────────────────── */}
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
        <span className="timesheet-week-hours">{totalH.toFixed(1)}h total</span>
      </div>

      {/* ── Weekly activity bar ───────────────────────────────────────────── */}
      <div style={{ marginBottom: 16, padding: '0 0 4px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Hours Logged This Week
            {leaveWorkdays > 0 && (
              <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--warning)' }}>
                · {leaveWorkdays} leave day{leaveWorkdays > 1 ? 's' : ''}
              </span>
            )}
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: barColor }}>
            {totalH.toFixed(1)}h
          </span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${activityPct}%`, borderRadius: 4,
            background: barColor, transition: 'width 0.4s ease',
          }} />
        </div>
        {weekGreeting && (
          <p style={{ margin: '6px 0 0', fontSize: 12, color: weekGreeting.color, fontStyle: 'italic' }}>
            {weekGreeting.text}
          </p>
        )}
      </div>

      {/* ── Current week entry form ─────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 className="card-title">Week of {formatDate(weekStartDate)}</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {currentWeekEntries.length > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={exportWeekPDF}
                title="Export this week as PDF"
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Download size={14} /> Export PDF
              </button>
            )}
            {!weekApproved && hasDraft && (
              <button className="btn btn-primary btn-sm"
                onClick={() => submitMutation.mutate(weekStartDate)}
                disabled={submitMutation.isPending || currentWeekEntries.length === 0}>
                {submitMutation.isPending
                  ? <><span className="spinner" style={{ width: 13, height: 13 }} /> Submitting…</>
                  : weekInReview
                    ? <><CheckSquare size={14} /> Submit Remaining</>
                    : <><CheckSquare size={14} /> Submit for Review</>}
              </button>
            )}
            {weekInReview && (
              <span className="badge badge-warning" title="You can still edit entries — they will remain under review.">
                {hasDraft ? 'Partial · Under Review' : 'Under Review ✎'}
              </span>
            )}
            {weekApproved && <span className="badge badge-success">Approved</span>}
          </div>
        </div>
        <TimesheetEntryForm
          weekStartDate={weekStartDate}
          existingEntries={currentWeekEntries}
          disabled={weekApproved}
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

      {/* ── My History ─────────────────────────────────────────────────────── */}
      {activeTab === 'my' && (
        <div>
          <div className="card card-sm" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <label className="form-label">From</label>
                <input type="date" className="form-input" value={myFrom} style={{ width: 160 }}
                  onChange={e => { setMyFrom(e.target.value); setMyPage(0) }} />
              </div>
              <div>
                <label className="form-label">To</label>
                <input type="date" className="form-input" value={myTo} style={{ width: 160 }}
                  onChange={e => { setMyTo(e.target.value); setMyPage(0) }} />
              </div>
              {(myFrom || myTo) && (
                <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-end' }}
                  onClick={() => { setMyFrom(''); setMyTo(''); setMyPage(0) }}>Clear</button>
              )}
            </div>
          </div>
          <TimesheetTable records={myHistory} isLoading={myLoading || myFetching}
            showEmployee={false}
            page={myPage} totalPages={myTotalPages} onPageChange={setMyPage} />
        </div>
      )}

      {/* ── Team Review ────────────────────────────────────────────────────── */}
      {activeTab === 'team' && canManage && (
        <div>
          <div className="card card-sm" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <label className="form-label">Employee ID</label>
                <input className="form-input" placeholder="Name or ID…" value={teamEmpId}
                  style={{ width: 140 }}
                  onChange={e => { setTeamEmpId(e.target.value); setTeamPage(0) }} />
              </div>
              <div>
                <label className="form-label">Status</label>
                <select className="form-select" value={teamStatus} style={{ width: 140 }}
                  onChange={e => { setTeamStatus(e.target.value); setTeamPage(0) }}>
                  <option value="">All</option>
                  {['SUBMITTED','APPROVED','REJECTED'].map(s =>
                    <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">From</label>
                <input type="date" className="form-input" value={teamFrom} style={{ width: 160 }}
                  onChange={e => { setTeamFrom(e.target.value); setTeamPage(0) }} />
              </div>
              <div>
                <label className="form-label">To</label>
                <input type="date" className="form-input" value={teamTo} style={{ width: 160 }}
                  onChange={e => { setTeamTo(e.target.value); setTeamPage(0) }} />
              </div>
              {(teamEmpId || teamStatus || teamFrom || teamTo) && (
                <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-end' }}
                  onClick={() => { setTeamEmpId(''); setTeamStatus(''); setTeamFrom(''); setTeamTo(''); setTeamPage(0) }}>
                  Clear
                </button>
              )}
              {teamHistory.length > 0 && (
                <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-end', display: 'flex', alignItems: 'center', gap: 6 }}
                  onClick={exportTeamPDF} title="Export visible team entries as PDF">
                  <Download size={14} /> Export PDF
                </button>
              )}
            </div>
          </div>
          <TimesheetTable records={teamHistory} isLoading={teamLoading || teamFetching}
            showEmployee={true}
            actions={(r) => {
              const exportSingle = () => {
                const empId = r.empId || 'EMP'
                // Collect all loaded entries for this employee + week (multi-project support)
                const weekEntries = teamHistory.filter(e => e.empId === r.empId && e.weekStartDate === r.weekStartDate)
                const DAYS_FULL   = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
                const HOURS_KEYS  = ['mondayHours','tuesdayHours','wednesdayHours','thursdayHours','fridayHours','saturdayHours','sundayHours']
                const weekEnd     = new Date(new Date(r.weekStartDate).getTime() + 6*24*60*60*1000).toISOString().split('T')[0]
                const wDate = new Date(r.weekStartDate)
                const jan4  = new Date(wDate.getFullYear(), 0, 4)
                const wk    = Math.ceil(((wDate - jan4) / 86400000 + jan4.getDay() + 1) / 7)
                const statusBg = r.status === 'APPROVED' ? '#d4edda' : r.status === 'SUBMITTED' ? '#fff3cd' : r.status === 'REJECTED' ? '#f8d7da' : '#eee'
                const statusFg = r.status === 'APPROVED' ? '#155724' : r.status === 'SUBMITTED' ? '#856404' : r.status === 'REJECTED' ? '#721c24' : '#555'
                const totalH = weekEntries.reduce((s, e) => s + (e.totalHours || 0), 0)
                const rows = weekEntries.flatMap(e =>
                  HOURS_KEYS.map((hk, i) => {
                    const h = parseFloat(e[hk]) || 0
                    if (h === 0) return ''
                    const timeCell = (e.startTime && e.endTime) ? `${e.startTime}–${e.endTime}` : e.startTime ? `From ${e.startTime}` : '—'
                    return `<tr><td>${DAYS_FULL[i]}</td><td><strong>${e.project || '—'}</strong></td><td>${e.taskDescription || '—'}</td><td style="text-align:center;font-size:11px;color:#555">${timeCell}</td><td style="text-align:center;font-weight:700;color:#4361ee">${h}h</td></tr>`
                  }).filter(Boolean)
                ).join('')
                const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Timesheet — ${empId} W${wk}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;padding:36px;color:#111;font-size:12px}
h1{font-size:20px;margin-bottom:6px;color:#1a1a2e}
.meta{background:#f4f4f8;border-radius:8px;padding:12px 16px;margin-bottom:20px;line-height:1.9;font-size:12px}.meta strong{color:#111}
table{width:100%;border-collapse:collapse;margin-bottom:16px}
th{background:#4361ee;color:#fff;padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.5px}
td{padding:8px 12px;border-bottom:1px solid #eee;vertical-align:top}
tr:nth-child(even) td{background:#fafafa}
.total{text-align:right;font-size:13px;font-weight:700;color:#333;margin-top:4px}
.footer{margin-top:28px;font-size:10px;color:#aaa;border-top:1px solid #eee;padding-top:12px}
@media print{body{padding:16px}}</style></head><body>
<h1>Employee Timesheet</h1>
<div class="meta">
  <strong>Employee:</strong> ${r.employeeName || '—'} (${empId}) &nbsp;|&nbsp; <strong>Department:</strong> ${r.department || '—'}<br>
  <strong>Week:</strong> ${formatDate(r.weekStartDate)} → ${formatDate(weekEnd)}&nbsp; (W${wk})<br>
  <strong>Status:</strong> <span style="background:${statusBg};color:${statusFg};padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700">${r.status}</span>
  &nbsp;|&nbsp; <strong>Submitted:</strong> ${r.submittedAt ? formatDate(r.submittedAt) : '—'}
  ${r.approvedBy ? `&nbsp;|&nbsp; <strong>Reviewed by:</strong> ${r.approvedBy}` : ''}
</div>
<table>
  <thead><tr><th>Day</th><th>Project</th><th>Task</th><th style="text-align:center">Time</th><th style="text-align:center">Hours</th></tr></thead>
  <tbody>${rows || '<tr><td colspan="5" style="text-align:center;color:#888;padding:16px">No entries</td></tr>'}</tbody>
</table>
<p class="total">Week Total: ${totalH.toFixed(1)}h across ${weekEntries.length} project${weekEntries.length !== 1 ? 's' : ''}</p>
<div class="footer">Exported by ${user?.name || 'Manager'} · TekSphere · ${new Date().toLocaleString()}</div>
<script>window.onload=()=>setTimeout(()=>window.print(),400)</script></body></html>`
                const blob = new Blob([html], { type: 'text/html' })
                const url  = URL.createObjectURL(blob)
                window.open(url, '_blank', 'width=900,height=650')
                const a = document.createElement('a')
                a.href = url; a.download = `${empId}_W${wk}.pdf`
                document.body.appendChild(a); a.click(); document.body.removeChild(a)
                setTimeout(() => URL.revokeObjectURL(url), 5000)
              }

              const isSelf = r.empId === user?.empId
              return (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button className="btn btn-ghost btn-sm" onClick={exportSingle}
                    title={`Export ${r.empId} timesheet`} style={{ padding: '4px 6px' }}>
                    <Download size={13} />
                  </button>
                  {r.status === 'SUBMITTED' && !isSelf && (
                    <>
                      <button className="btn btn-primary btn-sm"
                        onClick={() => reviewMutation.mutate({ id: r.id, action: 'APPROVED' })}
                        disabled={reviewMutation.isPending}>Approve</button>
                      <button className="btn btn-danger btn-sm"
                        onClick={() => reviewMutation.mutate({ id: r.id, action: 'REJECTED' })}
                        disabled={reviewMutation.isPending}>Reject</button>
                    </>
                  )}
                  {r.status === 'SUBMITTED' && isSelf && (
                    <span style={{ fontSize: 10, color: 'var(--warning)' }}>Self-review blocked</span>
                  )}
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
                <td style={{ fontSize: 13 }}>{formatWeek(firstWorkedDate(r))}</td>
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
