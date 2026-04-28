// src/utils/dateUtils.js
export function formatDate(dateStr) {
  if (!dateStr) return '—'
  try {
    return new Intl.DateTimeFormat('en-IN', { day:'2-digit', month:'short', year:'numeric' })
           .format(new Date(dateStr))
  } catch { return dateStr }
}

function isoWeekNumber(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7)
  const week1 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7)
}

// Returns e.g. "Wk 18 · Mon, 27 Apr"
// Pass the date of the first worked day (not always weekStartDate/Monday)
export function formatWeek(dateStr) {
  if (!dateStr) return '—'
  try {
    const d  = new Date(dateStr + 'T12:00:00')
    const wk = isoWeekNumber(d)
    const day = new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(d)
    const dm  = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(d)
    return `Wk ${wk} · ${day}, ${dm}`
  } catch { return dateStr }
}

const DAY_KEYS = ['mondayHours','tuesdayHours','wednesdayHours','thursdayHours','fridayHours','saturdayHours','sundayHours']

// Returns ISO date string of the first day with hours > 0 in a timesheet row
export function firstWorkedDate(row) {
  for (let i = 0; i < DAY_KEYS.length; i++) {
    if ((row[DAY_KEYS[i]] || 0) > 0) {
      const d = new Date(row.weekStartDate + 'T12:00:00')
      d.setDate(d.getDate() + i)
      return d.toISOString().split('T')[0]
    }
  }
  return row.weekStartDate
}
