// src/components/attendance/CheckInWidget.jsx
// Top-of-page widget showing today's check-in/out status with action buttons.

import { useState } from 'react'
import { LogIn, LogOut, Clock, CheckCircle, AlertCircle, Timer } from 'lucide-react'

const STATUS_CONFIG = {
  PRESENT:         { label: 'Present',        color: 'var(--success)', bg: 'var(--success-light)' },
  LATE:            { label: 'Late',            color: 'var(--warning)', bg: 'var(--warning-light)' },
  HALF_DAY:        { label: 'Half Day',        color: 'var(--warning)', bg: 'var(--warning-light)' },
  ABSENT:          { label: 'Absent',          color: 'var(--danger)',  bg: 'var(--danger-light)'  },
  ON_LEAVE:        { label: 'On Leave',        color: 'var(--info)',    bg: 'var(--info-light)'    },
  WORK_FROM_HOME:  { label: 'Work From Home',  color: 'var(--accent)',  bg: 'var(--accent-light)'  },
  HOLIDAY:         { label: 'Holiday',         color: 'var(--info)',    bg: 'var(--info-light)'    },
  WEEKEND:         { label: 'Weekend',         color: 'var(--text-muted)', bg: 'var(--bg-tertiary)' },
}

function formatTime(timeStr) {
  if (!timeStr) return '—'
  // LocalTime comes as "HH:MM:SS" from Spring
  const [h, m] = timeStr.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${m} ${ampm}`
}

export default function CheckInWidget({
  todayRecord,
  onCheckIn,
  onCheckOut,
  isCheckingIn,
  isCheckingOut,
}) {
  const [notes, setNotes] = useState('')
  const [showNotes, setShowNotes] = useState(false)

  const hasCheckedIn  = !!todayRecord?.checkInTime
  const hasCheckedOut = !!todayRecord?.checkOutTime
  const status        = todayRecord?.status
  const statusCfg     = status ? STATUS_CONFIG[status] : null

  const todayStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const handleCheckIn = () => {
    onCheckIn(notes || null)
    setNotes('')
    setShowNotes(false)
  }

  return (
    <div className="checkin-widget card" style={{ marginBottom: 24 }}>
      <div className="checkin-widget-inner">

        {/* Left: date + status */}
        <div className="checkin-left">
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>
            {todayStr}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Today</h3>
            {statusCfg && (
              <span style={{
                background: statusCfg.bg, color: statusCfg.color,
                padding: '3px 12px', borderRadius: 100, fontSize: 12, fontWeight: 600,
              }}>
                {statusCfg.label}
              </span>
            )}
            {!todayRecord && (
              <span style={{
                background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
                padding: '3px 12px', borderRadius: 100, fontSize: 12,
              }}>
                Not checked in
              </span>
            )}
          </div>
        </div>

        {/* Centre: check-in / check-out times */}
        <div className="checkin-times">
          <div className="checkin-time-item">
            <LogIn size={14} color="var(--success)" />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Check In</span>
            <span style={{ fontWeight: 600, fontSize: 14 }}>
              {formatTime(todayRecord?.checkInTime)}
            </span>
          </div>
          <div className="checkin-time-divider" />
          <div className="checkin-time-item">
            <LogOut size={14} color="var(--danger)" />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Check Out</span>
            <span style={{ fontWeight: 600, fontSize: 14 }}>
              {formatTime(todayRecord?.checkOutTime)}
            </span>
          </div>
          {todayRecord?.totalHours > 0 && (
            <>
              <div className="checkin-time-divider" />
              <div className="checkin-time-item">
                <Timer size={14} color="var(--accent)" />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Hours</span>
                <span style={{ fontWeight: 600, fontSize: 14 }}>
                  {todayRecord.totalHours}h
                </span>
              </div>
            </>
          )}
        </div>

        {/* Right: action buttons */}
        <div className="checkin-actions">
          {!hasCheckedIn && (
            <div>
              {showNotes && (
                <input
                  className="form-input"
                  placeholder="Optional note (e.g. WFH)…"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCheckIn() }}
                  style={{ marginBottom: 8, fontSize: 13 }}
                  autoFocus
                />
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-primary"
                  onClick={handleCheckIn}
                  disabled={isCheckingIn}
                  style={{ gap: 8 }}
                >
                  {isCheckingIn
                    ? <span className="spinner" style={{ width: 14, height: 14 }} />
                    : <LogIn size={15} />}
                  {isCheckingIn ? 'Checking in…' : 'Check In'}
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowNotes(v => !v)}
                  title="Add a note"
                  style={{ padding: '8px 10px' }}
                >
                  <Clock size={13} />
                </button>
              </div>
            </div>
          )}

          {hasCheckedIn && !hasCheckedOut && (
            <button
              className="btn btn-danger"
              onClick={onCheckOut}
              disabled={isCheckingOut}
            >
              {isCheckingOut
                ? <span className="spinner" style={{ width: 14, height: 14 }} />
                : <LogOut size={15} />}
              {isCheckingOut ? 'Checking out…' : 'Check Out'}
            </button>
          )}

          {hasCheckedIn && hasCheckedOut && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              color: 'var(--success)', fontSize: 14, fontWeight: 500,
            }}>
              <CheckCircle size={18} />
              Day complete
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
