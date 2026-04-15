// src/utils/errorUtils.js
export function parseApiError(err, fallback = 'An error occurred') {
  const data = err?.response?.data
  if (!data) return err?.message || fallback
  if (typeof data === 'string') return data
  return data.message || data.error || fallback
}
