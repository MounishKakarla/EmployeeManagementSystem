// src/components/attendance/AttendanceCalendar.jsx
// Monthly calendar heatmap showing attendance status per day.

const STATUS_COLORS = {
  PRESENT:        { bg: '#22c55e', color: '#ffffff', label: 'Present'       }, // Green (Success)
  LATE:           { bg: '#facc15', color: '#000000', label: 'Late'          }, // Yellow (Warning - black text for contrast)
  HALF_DAY:       { bg: '#fb923c', color: '#ffffff', label: 'Half Day'      }, // Orange (Partial)
  ABSENT:         { bg: '#ef4444', color: '#ffffff', label: 'Absent'        }, // Red (Danger)
  ON_LEAVE:       { bg: '#3b82f6', color: '#ffffff', label: 'On Leave'      }, // Blue (Info)
  WORK_FROM_HOME: { bg: '#8b5cf6', color: '#ffffff', label: 'WFH'           }, // Purple (Differentiation)
  HOLIDAY:        { bg: '#06b6d4', color: '#ffffff', label: 'Holiday'       }, // Cyan (Distinct from WFH/Leave)
  WEEKEND:        { bg: '#94a3b8', color: '#ffffff', label: 'Weekend'       }, // Slate Grey (Passive background)
}


const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function AttendanceCalendar({ records, month, year }) {
  // Build a map of date → record
  const recordMap = {}
  records.forEach(r => {
    recordMap[r.attendanceDate] = r
  })

  // Build calendar grid
  const firstDay   = new Date(year, month - 1, 1)
  const lastDay    = new Date(year, month, 0).getDate()
  const startDow   = firstDay.getDay()  // 0 = Sunday

  const cells = []
  // Leading empty cells
  for (let i = 0; i < startDow; i++) cells.push(null)
  // Day cells
  for (let d = 1; d <= lastDay; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const record  = recordMap[dateStr]
    const dow     = new Date(year, month - 1, d).getDay()
    const isToday = dateStr === new Date().toISOString().split('T')[0]
    const isWeekend = dow === 0 || dow === 6
    cells.push({ day: d, dateStr, record, isToday, isWeekend })
  }

  return (
    <div className="card" style={{ padding: 24 }}>
      <h3 className="card-title" style={{ marginBottom: 20 }}>
        Monthly Calendar
      </h3>

      {/* Day-of-week headers */}
      <div className="attendance-calendar-grid">
        {DAY_LABELS.map(d => (
          <div key={d} style={{
            textAlign: 'center', fontSize: 12, fontWeight: 600,
            color: 'var(--text-muted)', paddingBottom: 8,
          }}>
            {d}
          </div>
        ))}

        {/* Calendar cells */}
        {cells.map((cell, idx) => {
          if (!cell) return <div key={`empty-${idx}`} />

          const cfg = cell.record
            ? STATUS_COLORS[cell.record.status]
            : cell.isWeekend
              ? STATUS_COLORS.WEEKEND
              : null

          return (
            <div
              key={cell.dateStr}
              title={
                cell.record
                  ? `${cfg?.label} · ${cell.record.checkInTime ?? ''} – ${cell.record.checkOutTime ?? ''}`
                  : cell.isWeekend ? 'Weekend' : 'No record'
              }
              style={{
                aspectRatio: '1',
                borderRadius: 8,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: cell.isToday ? 800 : 500,
                background: cfg ? cfg.bg : 'var(--bg-primary)',
                color: cfg ? cfg.color : 'var(--text-muted)',
                border: cell.isToday ? '2px solid var(--accent)' : '2px solid transparent',
                cursor: cell.record ? 'pointer' : 'default',
                transition: 'transform 0.1s',
                userSelect: 'none',
              }}
              onMouseEnter={e => { if (cell.record) e.currentTarget.style.transform = 'scale(1.08)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
            >
              <span>{cell.day}</span>
              {cell.record && (
                <span style={{
                  fontSize: 8, marginTop: 2, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.5px',
                  lineHeight: 1,
                }}>
                  {cfg?.label?.split(' ')[0] ?? ''}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 20,
        paddingTop: 16, borderTop: '1px solid var(--border)',
      }}>
        {Object.entries(STATUS_COLORS).map(([key, { bg, color, label }]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 12, height: 12, borderRadius: 3,
              background: bg, border: `1px solid ${color}40`,
              flexShrink: 0,
            }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
