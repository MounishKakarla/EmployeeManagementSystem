// src/utils/dateUtils.js
export function formatDate(dateStr) {
  if (!dateStr) return '—'
  try {
    return new Intl.DateTimeFormat('en-IN', { day:'2-digit', month:'short', year:'numeric' })
           .format(new Date(dateStr))
  } catch { return dateStr }
}
