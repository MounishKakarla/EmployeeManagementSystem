// src/components/attendance/TeamAttendanceTable.jsx
// Admin/Manager paginated team attendance view with date range and employee filter.

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { attendanceAPI } from '../../api'
import { parseApiError } from '../../utils/errorUtils'
import Pagination from '../ui/Pagination'
import { AlertCircle, Search } from 'lucide-react'

const STATUS_BADGE = {
  PRESENT:        'badge-success',
  LATE:           'badge-warning',
  HALF_DAY:       'badge-warning',
  ABSENT:         'badge-danger',
  ON_LEAVE:       'badge-info',
  WORK_FROM_HOME: 'badge-accent',
  HOLIDAY:        'badge-info',
  WEEKEND:        'badge-neutral',
}

const PAGE_SIZE = 15

export default function TeamAttendanceTable() {
  const today = new Date()
  const firstOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
  const todayStr = today.toISOString().split('T')[0]

  const [start,    setStart]    = useState(firstOfMonth)
  const [end,      setEnd]      = useState(todayStr)
  const [empId,    setEmpId]    = useState('')
  const [page,     setPage]     = useState(0)

  const { data, isLoading, error } = useQuery({
    queryKey: ['attendance', 'team', start, end, empId, page],
    queryFn: () => attendanceAPI.getTeam(start, end, empId || undefined, {
      page, size: PAGE_SIZE, sort: 'attendanceDate,desc',
    }),
  })

  const records     = data?.data?.content || []
  const totalPages  = data?.data?.totalPages || 0
  const totalCount  = data?.data?.totalElements || 0

  const formatTime = (t) => {
    if (!t) return '—'
    const [h, m] = t.split(':')
    const hr = parseInt(h)
    return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`
  }

  return (
    <div>
      {/* Filters */}
      <div className="card card-sm" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label className="form-label">From</label>
            <input type="date" className="form-input" value={start}
              onChange={e => { setStart(e.target.value); setPage(0) }} style={{ width: 160 }} />
          </div>
          <div>
            <label className="form-label">To</label>
            <input type="date" className="form-input" value={end}
              onChange={e => { setEnd(e.target.value); setPage(0) }} style={{ width: 160 }} />
          </div>
          <div>
            <label className="form-label">Employee ID</label>
            <div className="search-box" style={{ width: 160 }}>
              <Search size={14} />
              <input
                className="form-input"
                placeholder="TT0001…"
                value={empId}
                onChange={e => { setEmpId(e.target.value); setPage(0) }}
              />
            </div>
          </div>
          {empId && (
            <button className="btn btn-ghost btn-sm" onClick={() => setEmpId('')}
              style={{ alignSelf: 'flex-end' }}>Clear</button>
          )}
        </div>
      </div>

      {error && (
        <div className="error-banner" style={{ marginBottom: 16 }}>
          <AlertCircle size={16} />
          {parseApiError(error, 'Failed to load team attendance')}
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        {isLoading ? (
          <div style={{ padding: 60, display: 'flex', justifyContent: 'center' }}>
            <div className="spinner" style={{ width: 28, height: 28 }} />
          </div>
        ) : records.length === 0 ? (
          <div className="empty-state">
            <Search size={36} />
            <h3>No records found</h3>
            <p style={{ fontSize: 14 }}>Try adjusting your date range or employee filter.</p>
          </div>
        ) : (
          <>
            <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Date</th>
                    <th>Check In</th>
                    <th>Check Out</th>
                    <th>Hours</th>
                    <th>Status</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map(r => (
                    <tr key={r.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
                            {r.employeeName?.split(' ').map(n => n[0]).join('').slice(0, 2) ?? '??'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 500, fontSize: 13 }}>{r.employeeName}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.empId}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: 13 }}>
                        {new Date(r.attendanceDate).toLocaleDateString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                      </td>
                      <td style={{ fontSize: 13 }}>{formatTime(r.checkInTime)}</td>
                      <td style={{ fontSize: 13 }}>{formatTime(r.checkOutTime)}</td>
                      <td style={{ fontSize: 13 }}>{r.totalHours ? `${r.totalHours}h` : '—'}</td>
                      <td>
                        <span className={`badge ${STATUS_BADGE[r.status] ?? 'badge-neutral'}`}
                          style={{ fontSize: 11 }}>
                          {r.status?.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 120,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.notes || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pagination-bar">
              <span className="pagination-info">
                {totalCount} record{totalCount !== 1 ? 's' : ''}
              </span>
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
              <span className="pagination-info">Page {page + 1} of {Math.max(1, totalPages)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
