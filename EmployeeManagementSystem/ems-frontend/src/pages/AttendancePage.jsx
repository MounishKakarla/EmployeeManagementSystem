// src/pages/AttendancePage.jsx
// Attendance page — three tabs: My Attendance, Daily Roster (admin/manager), Team Report (admin/manager)

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { attendanceAPI, holidayAPI } from '../api'
import { formatDate } from '../utils/dateUtils'
import useDocumentTitle from '../hooks/useDocumentTitle'
import { parseApiError } from '../utils/errorUtils'
import AttendanceCalendar from '../components/attendance/AttendanceCalendar'
import AttendanceSummaryCards from '../components/attendance/AttendanceSummaryCards'
import DailyRosterTable from '../components/attendance/DailyRosterTable'
import TeamAttendanceTable from '../components/attendance/TeamAttendanceTable'
import OverrideAttendanceModal from '../components/attendance/OverrideAttendanceModal'
import CheckInWidget from '../components/attendance/CheckInWidget'
import {
  CalendarDays, Users, BarChart3,
  UserCheck, ClipboardList, AlertCircle
} from 'lucide-react'
import toast from 'react-hot-toast'
import '../styles/attendance.css'

const TABS = [
  { key: 'my',     label: 'My Attendance', icon: UserCheck },
  { key: 'daily',  label: 'Daily Roster',  icon: ClipboardList, adminOnly: true },
  { key: 'team',   label: 'Team Report',   icon: BarChart3,     adminOnly: true },
]

export default function AttendancePage() {
  const { isAdmin, isManager } = useAuth()
  useDocumentTitle('Attendance | TekSphere')
  const qc = useQueryClient()

  const canManage  = isAdmin() || isManager()
  const today      = new Date()
  const thisMonth  = today.getMonth() + 1
  const thisYear   = today.getFullYear()

  const [activeTab,       setActiveTab]       = useState('my')
  const [selectedMonth,   setSelectedMonth]   = useState(thisMonth)
  const [selectedYear,    setSelectedYear]    = useState(thisYear)
  const [overrideOpen,    setOverrideOpen]    = useState(false)
  const [editRecord,      setEditRecord]      = useState(null)

  // ── Today's status ─────────────────────────────────────────────────────────
  const { data: todayData, refetch: refetchToday } = useQuery({
    queryKey: ['attendance', 'today'],
    queryFn: () => attendanceAPI.getToday(),
    retry: 1,
  })
  const todayRecord = todayData?.data

  // ── Monthly summary ────────────────────────────────────────────────────────
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['attendance', 'my-summary', selectedMonth, selectedYear],
    queryFn: () => attendanceAPI.getMySummary(selectedMonth, selectedYear),
  })
  const summary = summaryData?.data

  // ── Calendar range data (current month) ───────────────────────────────────
  const rangeStart = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
  const lastDay    = new Date(selectedYear, selectedMonth, 0).getDate()
  const rangeEnd   = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${lastDay}`

  const { data: rangeData } = useQuery({
    queryKey: ['attendance', 'my-range', rangeStart, rangeEnd],
    queryFn: () => attendanceAPI.getMyRange(rangeStart, rangeEnd),
  })
  const calendarRecords = rangeData?.data || []

  const { data: holidayRangeData } = useQuery({
    queryKey: ['holidays', selectedYear],
    queryFn: () => holidayAPI.getByYear(selectedYear),
  })

  const holidayDates = useMemo(() => {
    const raw = holidayRangeData?.data || []
    if (!Array.isArray(raw)) return new Set()

    return new Set(raw.map(item => {
      if (typeof item === 'string') return item
      if (item?.holidayDate) return item.holidayDate
      if (item?.date) return item.date
      if (item?.holiday_date) return item.holiday_date
      return null
    }).filter(Boolean))
  }, [holidayRangeData])

  const mergedRecords = useMemo(() => {
    const recordMap = new Map(calendarRecords.map(r => [r.attendanceDate, r]))
    holidayDates.forEach(date => {
      if (!recordMap.has(date)) {
        recordMap.set(date, { attendanceDate: date, status: 'HOLIDAY' })
      }
    })
    return Array.from(recordMap.values())
  }, [calendarRecords, holidayDates])

  // ── Recent History (last 10) ───────────────────────────────────────────────
  const { data: historyData } = useQuery({
    queryKey: ['attendance', 'my-history'],
    queryFn: () => attendanceAPI.getMyHistory({ page: 0, size: 10 }),
    enabled: activeTab === 'my',
  })
  const recentHistory = historyData?.data?.content || []

  // ── Check-in mutation ──────────────────────────────────────────────────────
  const checkInMutation = useMutation({
    mutationFn: (notes) => attendanceAPI.checkIn(notes),
    onSuccess: () => {
      toast.success('Checked in successfully!')
      qc.invalidateQueries({ queryKey: ['attendance'] })
    },
    onError: (err) => toast.error(parseApiError(err, 'Check-in failed')),
  })

  // ── Check-out mutation ─────────────────────────────────────────────────────
  const checkOutMutation = useMutation({
    mutationFn: () => attendanceAPI.checkOut(),
    onSuccess: () => {
      toast.success('Checked out successfully!')
      qc.invalidateQueries({ queryKey: ['attendance'] })
    },
    onError: (err) => toast.error(parseApiError(err, 'Check-out failed')),
  })

  const visibleTabs = TABS.filter(t => !t.adminOnly || canManage)

  return (
    <div className="attendance-page">

      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CalendarDays size={26} color="var(--accent)" />
            Attendance
          </h1>
          <p className="page-subtitle">
            Track daily check-ins, view history, and monitor team attendance
          </p>
        </div>
        <button
          className="btn btn-secondary"
          onClick={() => { setEditRecord(null); setOverrideOpen(true) }}
        >
          <ClipboardList size={15} /> Manual Entry
        </button>
      </div>

      {/* ── Check-in widget (always visible) ─────────────────────────────────── */}
      <CheckInWidget
        todayRecord={todayRecord}
        onCheckIn={(notes) => checkInMutation.mutate(notes)}
        onCheckOut={() => checkOutMutation.mutate()}
        isCheckingIn={checkInMutation.isPending}
        isCheckingOut={checkOutMutation.isPending}
      />

      {/* ── Tab switcher ──────────────────────────────────────────────────────── */}
      <div className="attendance-tabs">
        {visibleTabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`attendance-tab-btn ${activeTab === key ? 'active' : ''}`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* ── My Attendance tab ─────────────────────────────────────────────────── */}
      {activeTab === 'my' && (
        <div className="attendance-tab-content">

          {/* Month/Year picker */}
          <div className="attendance-period-picker card card-sm">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <label className="form-label" style={{ marginBottom: 0, whiteSpace: 'nowrap' }}>
                Viewing period:
              </label>
              <select
                className="form-select"
                style={{ width: 140 }}
                value={selectedMonth}
                onChange={e => setSelectedMonth(Number(e.target.value))}
              >
                {[
                  'January','February','March','April','May','June',
                  'July','August','September','October','November','December'
                ].map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
              <select
                className="form-select"
                style={{ width: 120 }}
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
              >
                {Array.from({ length: 11 }, (_, i) => thisYear - 5 + i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Summary cards */}
          <AttendanceSummaryCards summary={summary} isLoading={summaryLoading} />

          {/* Calendar heatmap */}
          <AttendanceCalendar
            records={mergedRecords}
            month={selectedMonth}
            year={selectedYear}
          />

          {/* ── Recent History (native-style list) ─────────────────────────── */}
          <RecentHistoryPanel records={recentHistory} onEdit={(record) => { setEditRecord(record); setOverrideOpen(true) }} />
        </div>
      )}

      {/* ── Daily Roster tab ──────────────────────────────────────────────────── */}
      {activeTab === 'daily' && canManage && (
        <DailyRosterTable />
      )}

      {/* ── Team Report tab ───────────────────────────────────────────────────── */}
      {activeTab === 'team' && canManage && (
        <TeamAttendanceTable />
      )}

      {/* ── Manual override modal ─────────────────────────────────────────────── */}
      <OverrideAttendanceModal
        open={overrideOpen}
        onClose={() => { setOverrideOpen(false); setEditRecord(null) }}
        editRecord={editRecord}
        onSuccess={() => qc.invalidateQueries({ queryKey: ['attendance'] })}
      />
    </div>
  )
}

// ── Recent History Panel ────────────────────────────────────────────────────────
function formatTimeStr(val) {
  if (!val) return '—'
  if (val.includes('T') || val.includes('-')) {
    const d = new Date(val)
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  }
  const [h, m] = val.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${String(h % 12 || 12).padStart(2,'0')}:${String(m).padStart(2,'0')} ${ampm}`
}

function computeDur(rec) {
  const inVal  = rec.checkInTime  || rec.checkIn
  const outVal = rec.checkOutTime || rec.checkOut
  if (!inVal || !outVal) return null
  const parseMin = (s) => {
    if (s.includes('T') || s.includes('-')) { const d = new Date(s); return d.getHours()*60+d.getMinutes() }
    const [h,m] = s.split(':').map(Number); return h*60+m
  }
  let diff = parseMin(outVal) - parseMin(inVal)
  if (diff <= 0) diff += 24 * 60  // overnight shift: checkout is next calendar day
  if (diff <= 0 || diff > 24 * 60) return null
  const h = Math.floor(diff / 60), m = diff % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

const STATUS_COLORS = {
  PRESENT:        { color: 'var(--success)', bg: 'var(--success-light)' },
  LATE:           { color: 'var(--warning)', bg: 'var(--warning-light)' },
  ABSENT:         { color: 'var(--danger)',  bg: 'var(--danger-light)'  },
  HALF_DAY:       { color: 'var(--warning)', bg: 'var(--warning-light)' },
  ON_LEAVE:       { color: 'var(--info)',    bg: 'var(--info-light)'    },
  WORK_FROM_HOME: { color: 'var(--accent)',  bg: 'var(--accent-light)'  },
  HOLIDAY:        { color: 'var(--info)',    bg: 'var(--info-light)'    },
}

function RecentHistoryPanel({ records, onEdit }) {
  if (!records.length) return null
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '18px 24px 0', display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <h3 className="card-title" style={{ margin:0 }}>Recent History</h3>
        <span style={{ fontSize:12, color:'var(--text-muted)' }}>Last {records.length} records</span>
      </div>
      <div className="attendance-history-list">
        {records.map((rec, i) => {
          const date    = rec.attendanceDate || rec.date || (rec.checkIn ? rec.checkIn.split('T')[0] : null)
          const inTime  = formatTimeStr(rec.checkInTime  || rec.checkIn)
          const outTime = formatTimeStr(rec.checkOutTime || rec.checkOut)
          const dur     = computeDur(rec)
          const cfg     = STATUS_COLORS[rec.status] || { color:'var(--text-muted)', bg:'var(--bg-tertiary)' }
          return (
            <div key={rec.id ?? i} className="attendance-history-row">
              <div className="attendance-history-date">
                <div style={{ fontWeight:600, fontSize:14 }}>
                  {date ? new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : '—'}
                </div>
                {rec.status && (
                  <span className="attendance-history-badge" style={{ color: cfg.color, background: cfg.bg }}>
                    {rec.status.replace(/_/g,' ')}
                  </span>
                )}
              </div>
              <div className="attendance-history-times">
                <span style={{ color:'var(--success)', fontWeight:600 }}>{inTime}</span>
                <span style={{ color:'var(--text-muted)', fontSize:12 }}>→</span>
                <span style={{ color: rec.checkOutTime || rec.checkOut ? 'var(--info)' : 'var(--text-muted)', fontWeight:600 }}>{outTime}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize:13, fontWeight:700, color: dur ? 'var(--accent)' : 'var(--text-muted)', minWidth:60, textAlign:'right' }}>
                  {dur ?? '—'}
                </div>
                {onEdit && (
                  <button className="btn btn-ghost btn-sm" onClick={() => onEdit(rec)} style={{ padding: '4px 6px' }} title="Edit Record">
                    <ClipboardList size={14} />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
