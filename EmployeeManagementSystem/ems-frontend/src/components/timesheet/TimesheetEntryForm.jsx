// src/components/timesheet/TimesheetEntryForm.jsx
// Each row = one task entry. User picks the day + hours per row.
import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { timesheetAPI } from '../../api'
import { parseApiError } from '../../utils/errorUtils'
import { Plus, Trash2, Save, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
// Only Mon–Fri are selectable working days
const WORKING_DAYS = DAYS.slice(0, 5)
const WORKING_DAY_LABELS = DAY_LABELS.slice(0, 5)

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

const emptyRow = (defaultDay = 'monday') => ({
  _key: Math.random().toString(36).slice(2),
  project: '',
  taskDescription: '',
  day: defaultDay,
  hours: '',
})

// Convert flat row → per-day API shape expected by timesheetAPI
function rowToApiPayload(row, weekStartDate) {
  const payload = {
    id: row.id,
    weekStartDate,
    project: row.project,
    taskDescription: row.taskDescription,
    mondayHours: 0,
    tuesdayHours: 0,
    wednesdayHours: 0,
    thursdayHours: 0,
    fridayHours: 0,
    saturdayHours: 0,
    sundayHours: 0,
  }
  payload[`${row.day}Hours`] = parseFloat(row.hours) || 0
  return payload
}

// Convert API entries (7-column shape) → flat rows (one row per non-zero day)
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
          hours: String(h),
        })
      }
    })
    // If all days are zero, still show one blank row for this entry so user can edit
    const hasAny = DAYS.some(d => parseFloat(e[`${d}Hours`]) || 0)
    if (!hasAny) {
      rows.push({
        _key: `${e.id}-empty`,
        id: e.id,
        project: e.project ?? '',
        taskDescription: e.taskDescription ?? '',
        day: 'monday',
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

  const updateRow = (key, field, value) =>
    setRows(prev => prev.map(r => r._key === key ? { ...r, [field]: value } : r))

  const addRow = () => setRows(prev => [...prev, emptyRow()])
  const removeRow = (key) => setRows(prev => prev.filter(r => r._key !== key))

  const validRows = rows.filter(r => r.project.trim() && r.taskDescription.trim() && r.hours !== '' && parseFloat(r.hours) > 0)

  // Summary: total hours per day across all rows
  const dayTotals = DAYS.map(day =>
    rows.reduce((sum, r) => sum + (r.day === day ? (parseFloat(r.hours) || 0) : 0), 0)
  )
  const grandTotal = dayTotals.reduce((a, b) => a + b, 0)

  return (
    <div className="timesheet-form">
      <div style={{ overflowX: 'auto' }}>
        <table className="timesheet-grid" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ minWidth: 160, textAlign: 'left', padding: '10px 12px' }}>Project <span style={{ color: 'var(--danger)' }}>*</span></th>
              <th style={{ minWidth: 180, textAlign: 'left', padding: '10px 12px' }}>Task <span style={{ color: 'var(--danger)' }}>*</span></th>
              <th style={{ minWidth: 150, textAlign: 'center', padding: '10px 12px' }}>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <Calendar size={13} /> Day
                </span>
              </th>
              <th style={{ minWidth: 100, textAlign: 'center', padding: '10px 12px' }}>Hours</th>
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
                    {WORKING_DAYS.map((day, idx) => (
                      <option key={day} value={day}>
                        {WORKING_DAY_LABELS[idx]} — {formatDateLabel(weekDates[idx])}
                      </option>
                    ))}
                  </select>
                </td>

                {/* Hours */}
                <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                  <input
                    type="number"
                    min="0"
                    max="24"
                    step="0.5"
                    className="form-input timesheet-hour-input"
                    placeholder="0"
                    value={row.hours}
                    disabled={disabled}
                    onChange={e => updateRow(row._key, 'hours', e.target.value)}
                    style={{
                      width: 80,
                      textAlign: 'center',
                      fontWeight: 700,
                      fontSize: 14,
                      color: parseFloat(row.hours) > 0 ? 'var(--accent)' : undefined,
                    }}
                  />
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
              <td
                colSpan={2}
                style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 12px' }}
              >
                Weekly Summary
              </td>
              <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                  {DAYS.map((day, idx) => (
                    dayTotals[idx] > 0 && (
                      <span
                        key={day}
                        style={{
                          fontSize: 11,
                          background: 'var(--bg-secondary)',
                          borderRadius: 4,
                          padding: '2px 7px',
                          color: dayTotals[idx] > 8 ? 'var(--danger)' : 'var(--text-primary)',
                        }}
                      >
                        {DAY_LABELS[idx]}: {dayTotals[idx]}h
                      </span>
                    )
                  ))}
                </div>
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
              // Check every row — all 3 fields are mandatory
              const incompleteRows = rows.filter(r =>
                !r.project.trim() || !r.taskDescription.trim() || !r.hours || parseFloat(r.hours) <= 0
              )
              if (incompleteRows.length > 0) {
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