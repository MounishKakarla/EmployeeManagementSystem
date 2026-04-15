// src/components/timesheet/TimesheetEntryForm.jsx
// Weekly grid: rows = projects, columns = Mon–Sun. Add/remove project rows.
import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { timesheetAPI } from '../../api'
import { parseApiError } from '../../utils/errorUtils'
import { Plus, Trash2, Save } from 'lucide-react'
import toast from 'react-hot-toast'

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

const emptyRow = () => ({
  _key:            Math.random().toString(36).slice(2),
  project:         '',
  taskDescription: '',
  mondayHours:     '',
  tuesdayHours:    '',
  wednesdayHours:  '',
  thursdayHours:   '',
  fridayHours:     '',
  saturdayHours:   '',
  sundayHours:     '',
})

function rowTotal(row) {
  return DAYS.reduce((sum, d) => sum + (parseFloat(row[d + 'Hours']) || 0), 0)
}

function colTotal(rows, day) {
  return rows.reduce((sum, r) => sum + (parseFloat(r[day + 'Hours']) || 0), 0)
}

export default function TimesheetEntryForm({
  weekStartDate, existingEntries, disabled, onSaved,
}) {
  const [rows, setRows] = useState([emptyRow()])

  // Populate from existing entries
  useEffect(() => {
    if (existingEntries && existingEntries.length > 0) {
      setRows(existingEntries.map(e => ({
        _key:            e.id?.toString() ?? Math.random().toString(36).slice(2),
        id:              e.id,
        project:         e.project ?? '',
        taskDescription: e.taskDescription ?? '',
        mondayHours:     e.mondayHours    ?? '',
        tuesdayHours:    e.tuesdayHours   ?? '',
        wednesdayHours:  e.wednesdayHours ?? '',
        thursdayHours:   e.thursdayHours  ?? '',
        fridayHours:     e.fridayHours    ?? '',
        saturdayHours:   e.saturdayHours  ?? '',
        sundayHours:     e.sundayHours    ?? '',
      })))
    }
  }, [existingEntries])

  const saveMutation = useMutation({
    mutationFn: async (rows) => {
      const results = await Promise.allSettled(
        rows.map(row => timesheetAPI.saveEntry({
          weekStartDate,
          project:         row.project,
          taskDescription: row.taskDescription,
          mondayHours:     parseFloat(row.mondayHours)    || 0,
          tuesdayHours:    parseFloat(row.tuesdayHours)   || 0,
          wednesdayHours:  parseFloat(row.wednesdayHours) || 0,
          thursdayHours:   parseFloat(row.thursdayHours)  || 0,
          fridayHours:     parseFloat(row.fridayHours)    || 0,
          saturdayHours:   parseFloat(row.saturdayHours)  || 0,
          sundayHours:     parseFloat(row.sundayHours)    || 0,
        }))
      )
      const failed = results.filter(r => r.status === 'rejected')
      if (failed.length > 0) throw new Error(failed[0].reason?.message || 'Some rows failed')
      return results
    },
    onSuccess: () => { toast.success('Timesheet saved!'); onSaved?.() },
    onError: (err) => toast.error(parseApiError(err, 'Save failed')),
  })

  const updateRow = (key, field, value) => {
    setRows(prev => prev.map(r => r._key === key ? { ...r, [field]: value } : r))
  }

  const addRow    = () => setRows(prev => [...prev, emptyRow()])
  const removeRow = (key) => setRows(prev => prev.filter(r => r._key !== key))

  const validRows = rows.filter(r => r.project.trim())

  return (
    <div className="timesheet-form">
      <div style={{ overflowX: 'auto' }}>
        <table className="timesheet-grid">
          <thead>
            <tr>
              <th style={{ minWidth: 160 }}>Project</th>
              <th style={{ minWidth: 180 }}>Task</th>
              {DAY_LABELS.map(d => (
                <th key={d} style={{ minWidth: 70, textAlign: 'center' }}>{d}</th>
              ))}
              <th style={{ minWidth: 70, textAlign: 'center' }}>Total</th>
              {!disabled && <th style={{ width: 40 }} />}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row._key}>
                <td>
                  <input className="form-input" placeholder="Project name…"
                    value={row.project} disabled={disabled}
                    onChange={e => updateRow(row._key, 'project', e.target.value)}
                    style={{ fontSize: 13, padding: '6px 10px' }} />
                </td>
                <td>
                  <input className="form-input" placeholder="Task…"
                    value={row.taskDescription} disabled={disabled}
                    onChange={e => updateRow(row._key, 'taskDescription', e.target.value)}
                    style={{ fontSize: 13, padding: '6px 10px' }} />
                </td>
                {DAYS.map(day => (
                  <td key={day} style={{ textAlign: 'center' }}>
                    <input
                      type="number" min="0" max="24" step="0.5"
                      className="form-input timesheet-hour-input"
                      value={row[day + 'Hours']} disabled={disabled}
                      onChange={e => updateRow(row._key, day + 'Hours', e.target.value)}
                    />
                  </td>
                ))}
                <td style={{ textAlign: 'center', fontWeight: 700,
                  color: rowTotal(row) > 0 ? 'var(--accent)' : 'var(--text-muted)',
                  fontSize: 14 }}>
                  {rowTotal(row) || 0}h
                </td>
                {!disabled && (
                  <td>
                    <button className="btn btn-ghost btn-sm"
                      onClick={() => removeRow(row._key)}
                      disabled={rows.length === 1}
                      style={{ padding: '6px 8px' }}>
                      <Trash2 size={13} color="var(--danger)" />
                    </button>
                  </td>
                )}
              </tr>
            ))}

            {/* Totals row */}
            <tr style={{ background: 'var(--bg-tertiary)', fontWeight: 600 }}>
              <td colSpan={2} style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 12px' }}>
                Daily Total
              </td>
              {DAYS.map(day => (
                <td key={day} style={{ textAlign: 'center', fontSize: 13,
                  color: colTotal(rows, day) > 8 ? 'var(--danger)' : 'var(--text-primary)' }}>
                  {colTotal(rows, day) || 0}h
                </td>
              ))}
              <td style={{ textAlign: 'center', fontSize: 14, color: 'var(--accent)' }}>
                {rows.reduce((s, r) => s + rowTotal(r), 0)}h
              </td>
              {!disabled && <td />}
            </tr>
          </tbody>
        </table>
      </div>

      {!disabled && (
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button className="btn btn-secondary btn-sm" onClick={addRow}>
            <Plus size={14} /> Add Project
          </button>
          <button className="btn btn-primary btn-sm"
            onClick={() => saveMutation.mutate(validRows)}
            disabled={saveMutation.isPending || validRows.length === 0}>
            {saveMutation.isPending
              ? <><span className="spinner" style={{ width: 13, height: 13 }} /> Saving…</>
              : <><Save size={14} /> Save Draft</>}
          </button>
        </div>
      )}
    </div>
  )
}
