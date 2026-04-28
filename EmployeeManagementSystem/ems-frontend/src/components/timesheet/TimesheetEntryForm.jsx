// src/components/timesheet/TimesheetEntryForm.jsx
import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { timesheetAPI } from '../../api'
import { parseApiError } from '../../utils/errorUtils'
import { Plus, Trash2, Save, Calendar, Clock } from 'lucide-react'
import toast from 'react-hot-toast'

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getWeekDates(weekStartDate) {
  return DAYS.map((_, idx) => {
    const d = new Date(weekStartDate)
    d.setDate(d.getDate() + idx)
    return d
  })
}

function formatDateLabel(date) {
  return `${date.getDate()} ${date.toLocaleString('en-US', { month: 'short' })}`
}

function to12hr(time24) {
  if (!time24) return ''
  const [h, m] = time24.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

function timeDiffHours(start, end) {
  if (!start || !end) return null
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let diff = (eh * 60 + em) - (sh * 60 + sm)
  if (diff < 0) diff += 24 * 60
  return diff > 0 ? (diff / 60).toFixed(1) : null
}

const emptyRow = () => ({
  _key: Math.random().toString(36).slice(2),
  project: '',
  taskDescription: '',
  day: 'monday',
  startTime: '',
  endTime: '',
  hours: '',
})

function rowToApiPayload(row, weekStartDate) {
  const payload = {
    id: row.id,
    weekStartDate,
    project: row.project,
    taskDescription: row.taskDescription,
    startTime: row.startTime || undefined,
    endTime: row.endTime || undefined,
    mondayHours: 0, tuesdayHours: 0, wednesdayHours: 0,
    thursdayHours: 0, fridayHours: 0, saturdayHours: 0, sundayHours: 0,
  }
  payload[`${row.day}Hours`] = parseFloat(row.hours) || 0
  return payload
}

function apiEntriesToRows(entries) {
  const rows = []
  entries.forEach(e => {
    DAYS.forEach(day => {
      const h = parseFloat(e[`${day}Hours`]) || 0
      if (h > 0) {
        rows.push({
          _key: `${e.id}-${day}`,
          id: e.id,
          project: e.project ?? '',
          taskDescription: e.taskDescription ?? '',
          day,
          startTime: e.startTime ?? '',
          endTime: e.endTime ?? '',
          hours: String(h),
        })
      }
    })
    const hasAny = DAYS.some(d => parseFloat(e[`${d}Hours`]) || 0)
    if (!hasAny) {
      rows.push({
        _key: `${e.id}-empty`,
        id: e.id,
        project: e.project ?? '',
        taskDescription: e.taskDescription ?? '',
        day: 'monday',
        startTime: e.startTime ?? '',
        endTime: e.endTime ?? '',
        hours: '',
      })
    }
  })
  return rows.length > 0 ? rows : [emptyRow()]
}

export default function TimesheetEntryForm({
  weekStartDate, existingEntries, disabled, onSaved,
}) {
  const [rows, setRows] = useState([emptyRow()])
  const [use12hr, setUse12hr] = useState(false)
  const weekDates = getWeekDates(weekStartDate)

  useEffect(() => {
    if (existingEntries && existingEntries.length > 0) {
      setRows(apiEntriesToRows(existingEntries))
    } else {
      setRows([emptyRow()])
    }
  }, [existingEntries, weekStartDate])

  const saveMutation = useMutation({
    mutationFn: async (rows) => {
      const results = await Promise.allSettled(
        rows.map(row => timesheetAPI.saveEntry(rowToApiPayload(row, weekStartDate)))
      )
      const failed = results.filter(r => r.status === 'rejected')
      if (failed.length > 0) throw new Error(failed[0].reason?.message || 'Some rows failed')
      return results
    },
    onSuccess: () => { toast.success('Timesheet saved!'); onSaved?.() },
    onError: (err) => toast.error(parseApiError(err, 'Save failed')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => timesheetAPI.deleteEntry(id),
    onSuccess: () => { toast.success('Entry deleted'); onSaved?.() },
    onError: (err) => toast.error(parseApiError(err, 'Delete failed')),
  })

  const updateRow = (key, field, value) =>
    setRows(prev => prev.map(r => {
      if (r._key !== key) return r
      const updated = { ...r, [field]: value }
      // Auto-calculate hours when both times are set
      if (field === 'startTime' || field === 'endTime') {
        const st = field === 'startTime' ? value : r.startTime
        const et = field === 'endTime'   ? value : r.endTime
        const auto = timeDiffHours(st, et)
        if (auto) updated.hours = auto
      }
      return updated
    }))

  const addRow = () => setRows(prev => [...prev, emptyRow()])

  const removeRow = (key) => {
    const row = rows.find(r => r._key === key)
    if (row?.id) deleteMutation.mutate(row.id)
    else setRows(prev => prev.filter(r => r._key !== key))
  }

  const dayTotals = DAYS.map(day =>
    rows.reduce((sum, r) => sum + (r.day === day ? (parseFloat(r.hours) || 0) : 0), 0)
  )
  const grandTotal = dayTotals.reduce((a, b) => a + b, 0)

  const timeLabel = (t) => t ? (use12hr ? to12hr(t) : t) : '—'

  return (
    <div className="timesheet-form">
      {/* Format toggle */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setUse12hr(p => !p)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
        >
          <Clock size={13} />
          {use12hr ? '12-hr' : '24-hr'} format
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="timesheet-grid" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ minWidth: 150, textAlign: 'left', padding: '10px 12px' }}>
                Project <span style={{ color: 'var(--danger)' }}>*</span>
              </th>
              <th style={{ minWidth: 170, textAlign: 'left', padding: '10px 12px' }}>
                Task <span style={{ color: 'var(--danger)' }}>*</span>
              </th>
              <th style={{ minWidth: 140, textAlign: 'center', padding: '10px 12px' }}>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <Calendar size={13} /> Day
                </span>
              </th>
              <th style={{ minWidth: 110, textAlign: 'center', padding: '10px 12px' }}>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <Clock size={13} /> Start
                </span>
              </th>
              <th style={{ minWidth: 110, textAlign: 'center', padding: '10px 12px' }}>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <Clock size={13} /> End
                </span>
              </th>
              <th style={{ minWidth: 90, textAlign: 'center', padding: '10px 12px' }}>Hours</th>
              {!disabled && <th style={{ width: 40 }} />}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row._key}>
                {/* Project */}
                <td style={{ padding: '6px 8px' }}>
                  <input
                    className="form-input"
                    placeholder="Project name *"
                    value={row.project}
                    disabled={disabled}
                    onChange={e => updateRow(row._key, 'project', e.target.value)}
                    style={{
                      fontSize: 13, padding: '6px 10px', width: '100%',
                      borderColor: !disabled && !row.project.trim() ? 'var(--danger)' : undefined,
                    }}
                  />
                </td>

                {/* Task */}
                <td style={{ padding: '6px 8px' }}>
                  <input
                    className="form-input"
                    placeholder="Task description *"
                    value={row.taskDescription}
                    disabled={disabled}
                    onChange={e => updateRow(row._key, 'taskDescription', e.target.value)}
                    style={{
                      fontSize: 13, padding: '6px 10px', width: '100%',
                      borderColor: !disabled && !row.taskDescription.trim() ? 'var(--danger)' : undefined,
                    }}
                  />
                </td>

                {/* Day selector */}
                <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                  <select
                    className="form-input"
                    value={row.day}
                    disabled={disabled}
                    onChange={e => updateRow(row._key, 'day', e.target.value)}
                    style={{ fontSize: 13, padding: '6px 10px', width: '100%', cursor: 'pointer' }}
                  >
                    {DAYS.map((day, idx) => (
                      <option key={day} value={day}>
                        {DAY_LABELS[idx]} — {formatDateLabel(weekDates[idx])}
                      </option>
                    ))}
                  </select>
                </td>

                {/* Start Time */}
                <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                  {disabled ? (
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      {row.startTime ? timeLabel(row.startTime) : '—'}
                    </span>
                  ) : (
                    <input
                      type="time"
                      className="form-input"
                      value={row.startTime}
                      onChange={e => updateRow(row._key, 'startTime', e.target.value)}
                      style={{ fontSize: 13, padding: '6px 8px', width: '100%', textAlign: 'center' }}
                    />
                  )}
                  {!disabled && row.startTime && use12hr && (
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                      {to12hr(row.startTime)}
                    </div>
                  )}
                </td>

                {/* End Time */}
                <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                  {disabled ? (
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      {row.endTime ? timeLabel(row.endTime) : '—'}
                    </span>
                  ) : (
                    <input
                      type="time"
                      className="form-input"
                      value={row.endTime}
                      onChange={e => updateRow(row._key, 'endTime', e.target.value)}
                      style={{ fontSize: 13, padding: '6px 8px', width: '100%', textAlign: 'center' }}
                    />
                  )}
                  {!disabled && row.endTime && use12hr && (
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                      {to12hr(row.endTime)}
                    </div>
                  )}
                </td>

                {/* Hours — auto-calculated from times, or manual */}
                <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                  {(() => {
                    const isAuto = !disabled && row.startTime && row.endTime
                    return (
                      <>
                        <input
                          type="number"
                          min="0"
                          max="24"
                          step="0.5"
                          className="form-input timesheet-hour-input"
                          placeholder="0"
                          value={row.hours}
                          disabled={disabled || isAuto}
                          onChange={e => updateRow(row._key, 'hours', e.target.value)}
                          style={{
                            width: 80, textAlign: 'center', fontWeight: 700, fontSize: 14,
                            color: parseFloat(row.hours) > 0 ? 'var(--success)' : undefined,
                            background: isAuto ? 'var(--bg-tertiary)' : undefined,
                            cursor: isAuto ? 'default' : undefined,
                          }}
                        />
                        {isAuto && (
                          <div style={{ fontSize: 10, color: 'var(--success)', marginTop: 2, fontWeight: 600 }}>
                            ⚡ auto
                          </div>
                        )}
                      </>
                    )
                  })()}
                </td>

                {/* Remove */}
                {!disabled && (
                  <td style={{ padding: '6px 4px' }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => removeRow(row._key)}
                      disabled={rows.length === 1}
                      style={{ padding: '6px 8px' }}
                    >
                      <Trash2 size={13} color="var(--danger)" />
                    </button>
                  </td>
                )}
              </tr>
            ))}

            {/* Daily summary footer */}
            <tr style={{ background: 'var(--bg-tertiary)', fontWeight: 600 }}>
              <td colSpan={2} style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 12px' }}>
                Weekly Summary
              </td>
              <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                  {DAYS.map((day, idx) => (
                    dayTotals[idx] > 0 && (
                      <span key={day} style={{
                        fontSize: 11, background: 'var(--bg-secondary)', borderRadius: 4,
                        padding: '2px 7px',
                        color: dayTotals[idx] > 8 ? 'var(--danger)' : 'var(--text-primary)',
                      }}>
                        {DAY_LABELS[idx]}: {dayTotals[idx]}h
                      </span>
                    )
                  ))}
                </div>
              </td>
              <td colSpan={2} style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', padding: '8px 12px' }}>
                {rows.some(r => r.startTime) && (
                  <span>{rows.filter(r => r.startTime).map(r =>
                    `${r.startTime}${r.endTime ? '–' + r.endTime : ''}`
                  ).join(', ')}</span>
                )}
              </td>
              <td style={{ textAlign: 'center', fontSize: 14, color: 'var(--accent)', padding: '8px 12px' }}>
                {grandTotal}h
              </td>
              {!disabled && <td />}
            </tr>
          </tbody>
        </table>
      </div>

      {!disabled && (
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button className="btn btn-secondary btn-sm" onClick={addRow}>
            <Plus size={14} /> Add Task
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              const incomplete = rows.filter(r =>
                !r.project.trim() || !r.taskDescription.trim() || !r.hours || parseFloat(r.hours) <= 0
              )
              if (incomplete.length > 0) {
                toast.error('All fields are required: Project, Task Description, and Hours (> 0)')
                return
              }
              saveMutation.mutate(rows)
            }}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending
              ? <><span className="spinner" style={{ width: 13, height: 13 }} /> Saving…</>
              : <><Save size={14} /> Save Draft</>}
          </button>
        </div>
      )}
    </div>
  )
}
