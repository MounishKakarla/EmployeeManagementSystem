// src/components/attendance/AttendanceSummaryCards.jsx
// Shows monthly attendance stats as a row of colored stat cards.

import Skeleton from '../ui/Skeleton'
import {
  UserCheck, UserX, Clock, AlertTriangle,
  Umbrella, Monitor, Trophy, Percent
} from 'lucide-react'

const CARDS = [
  { key: 'presentDays',      label: 'Present',       icon: UserCheck,     color: 'var(--success)', bg: 'var(--success-light)' },
  { key: 'absentDays',       label: 'Absent',        icon: UserX,         color: 'var(--danger)',  bg: 'var(--danger-light)'  },
  { key: 'lateDays',         label: 'Late',          icon: AlertTriangle, color: 'var(--warning)', bg: 'var(--warning-light)' },
  { key: 'halfDays',         label: 'Half Days',     icon: Clock,         color: 'var(--accent)',  bg: 'var(--accent-light)'  },
  { key: 'onLeaveDays',      label: 'On Leave',      icon: Umbrella,      color: 'var(--info)',    bg: 'var(--info-light)'    },
  { key: 'workFromHomeDays', label: 'WFH',           icon: Monitor,       color: 'var(--accent)',  bg: 'var(--accent-light)'  },
]

export default function AttendanceSummaryCards({ summary, isLoading }) {
  if (isLoading) {
    return (
      <div className="attendance-summary-grid">
        {CARDS.map((_, i) => (
          <div key={i} className="card" style={{ padding: 20 }}>
            <Skeleton height="40px" width="40px" borderRadius="8px" style={{ marginBottom: 12 }} />
            <Skeleton height="28px" width="48px" style={{ marginBottom: 6 }} />
            <Skeleton height="14px" width="64px" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      {/* Percentage hero */}
      {summary && (
        <div className="card attendance-percentage-card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'var(--accent-light)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Percent size={24} color="var(--accent)" />
            </div>
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 2 }}>
                Attendance Rate
              </div>
              <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)' }}>
                {summary.attendancePercentage ?? 0}%
              </div>
            </div>
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Total Hours</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>
                {summary.totalHoursWorked ?? 0}h
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                avg {summary.averageHoursPerDay ?? 0}h/day
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stat cards grid */}
      <div className="attendance-summary-grid">
        {CARDS.map(({ key, label, icon: Icon, color, bg }) => (
          <div key={key} className="stat-card">
            <div className="stat-icon" style={{ background: bg }}>
              <Icon size={18} color={color} />
            </div>
            <div className="stat-value">{summary?.[key] ?? 0}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
