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

// Returns e.g. "Wk 17 · Mon, 27 Apr"
export function formatWeek(dateStr) {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    const wk  = isoWeekNumber(d)
    const day = new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(d)
    const dm  = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(d)
    return `Wk ${wk} · ${day}, ${dm}`
  } catch { return dateStr }
}
