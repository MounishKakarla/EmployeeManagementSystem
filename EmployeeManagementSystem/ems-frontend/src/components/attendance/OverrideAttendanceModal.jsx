// src/components/attendance/OverrideAttendanceModal.jsx
// Admin/Manager form to create or edit an attendance record manually.

import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { attendanceAPI } from '../../api'
import { parseApiError } from '../../utils/errorUtils'
import Modal from '../ui/Modal'
import { BaseSelect } from '../ui/BaseComponents'
import toast from 'react-hot-toast'

const STATUS_OPTIONS = [
  { value: 'PRESENT',        label: 'Present'        },
  { value: 'LATE',           label: 'Late'           },
  { value: 'HALF_DAY',       label: 'Half Day'       },
  { value: 'ABSENT',         label: 'Absent'         },
  { value: 'ON_LEAVE',       label: 'On Leave'       },
  { value: 'WORK_FROM_HOME', label: 'Work From Home' },
  { value: 'HOLIDAY',        label: 'Holiday'        },
  { value: 'WEEKEND',        label: 'Weekend'        },
]

// ── Time helpers ──────────────────────────────────────────────────────────────

// Parse "HH:MM" or "H:MM" → { h, m } | null (validates 0-23, 0-59)
function parse24(v) {
  const match = /^(\d{1,2}):(\d{2})$/.exec((v || '').trim())
  if (!match) return null
  const h = parseInt(match[1], 10), m = parseInt(match[2], 10)
  if (h > 23 || m > 59) return null
  return { h, m }
}

// Parse "H:MM AM/PM" → { h (0-23), m } | null
function parse12(v) {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec((v || '').trim())
  if (!match) return null
  let h = parseInt(match[1], 10), m = parseInt(match[2], 10)
  const period = match[3].toUpperCase()
  if (h < 1 || h > 12 || m > 59) return null
  if (period === 'AM' && h === 12) h = 0
  if (period === 'PM' && h !== 12) h += 12
  return { h, m }
}

function to24str({ h, m }) {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function to12str({ h, m }) {
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

function toMins(hhmm) {
  const p = parse24(hhmm)
  return p ? p.h * 60 + p.m : null
}

function fmtDuration(mins) {
  if (!mins || mins <= 0) return null
  const h = Math.floor(mins / 60), m = mins % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

// ── Dual-format time input component ─────────────────────────────────────────
// value / onChange use 24h "HH:MM" as canonical form.
// Both the 24h field and 12h field are editable and stay in sync.
function DualTimeInput({ label, value, onChange }) {
  const [raw24, setRaw24] = useState(value || '')
  const [raw12, setRaw12] = useState(() => {
    const p = parse24(value)
    return p ? to12str(p) : ''
  })
  const [err24, setErr24] = useState('')
  const [err12, setErr12] = useState('')

  // Sync when parent resets value (e.g. modal reopen)
  useEffect(() => {
    setRaw24(value || '')
    const p = parse24(value)
    setRaw12(p ? to12str(p) : '')
    setErr24(''); setErr12('')
  }, [value])

  const handle24 = (v) => {
    setRaw24(v)
    if (!v) { setErr24(''); setRaw12(''); onChange(''); return }
    const p = parse24(v)
    if (p) {
      setErr24('')
      setRaw12(to12str(p))
      onChange(to24str(p))
    } else {
      setErr24('Invalid — use HH:MM (00:00 – 23:59)')
    }
  }

  const handle12 = (v) => {
    setRaw12(v)
    if (!v) { setErr12(''); setRaw24(''); onChange(''); return }
    const p = parse12(v)
    if (p) {
      setErr12('')
      const s = to24str(p)
      setRaw24(s)
      onChange(s)
    } else {
      setErr12('Use H:MM AM or H:MM PM (e.g. 9:00 AM)')
    }
  }

  return (
    <div className="form-group" style={{ marginBottom: 0 }}>
      <label className="form-label">{label}</label>
      <div style={{ display: 'flex', gap: 8 }}>
        {/* 24-hour input */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            24-hour (HH:MM)
          </div>
          <input
            className="form-input"
            style={{ borderColor: err24 ? 'var(--danger)' : undefined }}
            placeholder="09:00"
            value={raw24}
            onChange={e => handle24(e.target.value)}
            maxLength={5}
          />
          {err24
            ? <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 3 }}>{err24}</div>
            : raw24 && parse24(raw24) && (
              <div style={{ fontSize: 12, color: 'var(--success)', marginTop: 3, fontWeight: 600 }}>
                ✓ Valid 24h time
              </div>
            )
          }
        </div>

        {/* 12-hour input */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            12-hour (H:MM AM/PM)
          </div>
          <input
            className="form-input"
            style={{ borderColor: err12 ? 'var(--danger)' : undefined }}
            placeholder="9:00 AM"
            value={raw12}
            onChange={e => handle12(e.target.value)}
            maxLength={8}
          />
          {err12
            ? <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 3 }}>{err12}</div>
            : raw12 && parse12(raw12) && (
              <div style={{ fontSize: 12, color: 'var(--info)', marginTop: 3, fontWeight: 600 }}>
                ✓ Valid 12h time
              </div>
            )
          }
        </div>
      </div>
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export default function OverrideAttendanceModal({ open, onClose, editRecord, onSuccess }) {
  const { user } = useAuth()
  const isEdit = !!editRecord

  const { register, handleSubmit, control, watch, reset, formState: { errors } } = useForm({
    defaultValues: {
      empId:          user?.empId || '',
      attendanceDate: new Date().toISOString().split('T')[0],
      checkInTime:    '',
      checkOutTime:   '',
      status:         'PRESENT',
      notes:          '',
    },
  })

  const checkInTime  = watch('checkInTime')
  const checkOutTime = watch('checkOutTime')

  const inMins  = toMins(checkInTime)
  const outMins = toMins(checkOutTime)
  const duration  = (inMins !== null && outMins !== null) ? fmtDuration(outMins - inMins) : null
  const timeError = (inMins !== null && outMins !== null && outMins <= inMins)
    ? 'Check-out must be after check-in'
    : null

  useEffect(() => {
    if (editRecord) {
      reset({
        empId:          editRecord.empId          ?? '',
        attendanceDate: editRecord.attendanceDate ?? '',
        checkInTime:    editRecord.checkInTime?.slice(0, 5) ?? '',
        checkOutTime:   editRecord.checkOutTime?.slice(0, 5) ?? '',
        status:         editRecord.status         ?? 'PRESENT',
        notes:          editRecord.notes          ?? '',
      })
    } else {
      reset({
        empId:          user?.empId || '',
        attendanceDate: new Date().toISOString().split('T')[0],
        checkInTime:    '',
        checkOutTime:   '',
        status:         'PRESENT',
        notes:          '',
      })
    }
  }, [editRecord, open, user, reset])

  const mutation = useMutation({
    mutationFn: (data) => {
      if (isEdit) {
        return attendanceAPI.update(editRecord.id, {
          checkInTime:  data.checkInTime  || null,
          checkOutTime: data.checkOutTime || null,
          status:       data.status,
          notes:        data.notes || null,
        })
      }
      return attendanceAPI.override({
        empId:          data.empId,
        attendanceDate: data.attendanceDate,
        checkInTime:    data.checkInTime  || null,
        checkOutTime:   data.checkOutTime || null,
        status:         data.status,
        notes:          data.notes || null,
      })
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Attendance updated' : 'Attendance record saved')
      onSuccess?.()
      onClose()
    },
    onError: (err) => toast.error(parseApiError(err, 'Failed to save attendance')),
  })

  const onSubmit = (data) => {
    if (timeError) return
    mutation.mutate(data)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Attendance Record' : 'Manual Attendance Entry'}
      size="md"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}
            disabled={mutation.isPending}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit(onSubmit)}
            disabled={mutation.isPending || !!timeError}>
            {mutation.isPending
              ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Saving…</>
              : isEdit ? 'Update Record' : 'Save Record'}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Employee ID — always auto-filled, read-only */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Employee ID</label>
          <input className="form-input" readOnly
            style={{ background: 'var(--bg-tertiary)', cursor: 'not-allowed' }}
            {...register('empId')} />
        </div>

        {/* Date — auto-filled, read-only */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Attendance Date</label>
          <input className="form-input" type="date" readOnly
            style={{ background: 'var(--bg-tertiary)', cursor: 'not-allowed' }}
            {...register('attendanceDate')} />
        </div>

        {/* Check-in time — dual format */}
        <Controller
          name="checkInTime"
          control={control}
          render={({ field }) => (
            <DualTimeInput
              label="Check-in Time"
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />

        {/* Check-out time — dual format */}
        <Controller
          name="checkOutTime"
          control={control}
          render={({ field }) => (
            <DualTimeInput
              label="Check-out Time"
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />

        {/* Duration / cross-field error */}
        {(duration || timeError) && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: timeError ? 'var(--danger-light)' : 'var(--info-light)',
            color:      timeError ? 'var(--danger)'       : 'var(--info)',
          }}>
            <span>{timeError ? '⚠️' : '⏱'}</span>
            <span>{timeError ?? `Duration: ${duration}`}</span>
          </div>
        )}

        <BaseSelect
          label="Status"
          options={STATUS_OPTIONS}
          error={errors.status?.message}
          {...register('status', { required: 'Status is required' })}
        />

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Notes (optional)</label>
          <textarea
            className="form-input"
            rows={2}
            placeholder="Reason for manual entry…"
            style={{ resize: 'vertical' }}
            {...register('notes')}
          />
        </div>

      </div>
    </Modal>
  )
}
