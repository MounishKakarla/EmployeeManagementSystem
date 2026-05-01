// src/components/attendance/DailyRosterTable.jsx
// Admin/Manager daily attendance roster for any selected date.

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { attendanceAPI } from '../../api'
import { formatDate } from '../../utils/dateUtils'
import { parseApiError } from '../../utils/errorUtils'
import { Search, RefreshCw, AlertCircle, Pencil } from 'lucide-react'

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

const DEPARTMENTS = [
  'DEVELOPMENT','FINANCE','DESIGN','HR','SALES','MARKETING','SUPPORT',
  'ADMINISTRATION','HOSPITALITY','PROCUREMENT',
]

export default function DailyRosterTable({ onEdit }) {
  const today = new Date().toISOString().split('T')[0]
  const [selectedDate,  setSelectedDate]  = useState(today)
  const [filterDept,    setFilterDept]    = useState('')

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['attendance', 'daily', selectedDate, filterDept],
    queryFn: () => attendanceAPI.getDaily(selectedDate, filterDept || undefined),
  })

  const records = data?.data || []

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
            <label className="form-label">Date</label>
            <input
              type="date"
              className="form-input"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              style={{ width: 180 }}
            />
          </div>
          <div>
            <label className="form-label">Department</label>
            <select
              className="form-select"
              value={filterDept}
              style={{ width: 180 }}
              onChange={e => setFilterDept(e.target.value)}
            >
              <option value="">All Departments</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => refetch()}
            style={{ alignSelf: 'flex-end' }}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner" style={{ marginBottom: 16 }}>
          <AlertCircle size={16} />
          {parseApiError(error, 'Failed to load roster')}
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
            <h3>No records for {formatDate(selectedDate)}</h3>
            <p style={{ fontSize: 14 }}>No attendance has been recorded for this date.</p>
          </div>
        ) : (
          <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Hours</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {r.profileImage ? (
                          <img src={r.profileImage} alt={r.employeeName} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)' }} />
                        ) : (
                          <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
                            {r.employeeName?.split(' ').map(n => n[0]).join('').slice(0, 2) ?? '??'}
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 500, fontSize: 14 }}>{r.employeeName}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.empId}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-info" style={{ fontSize: 11 }}>
                        {r.department?.split(',')[0]?.trim() ?? '—'}
                      </span>
                    </td>
                    <td style={{ fontSize: 13, fontWeight: 500 }}>{formatTime(r.checkInTime)}</td>
                    <td style={{ fontSize: 13 }}>{formatTime(r.checkOutTime)}</td>
                    <td style={{ fontSize: 13 }}>{r.totalHours ? `${r.totalHours}h` : '—'}</td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[r.status] ?? 'badge-neutral'}`}>
                        {r.status?.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => onEdit(r)}
                        title="Edit record"
                      >
                        <Pencil size={13} /> Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {records.length > 0 && (
          <div className="pagination-bar">
            <span className="pagination-info">{records.length} record{records.length !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>
    </div>
  )
}
