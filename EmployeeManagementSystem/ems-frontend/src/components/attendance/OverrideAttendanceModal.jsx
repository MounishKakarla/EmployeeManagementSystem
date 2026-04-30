// src/components/attendance/OverrideAttendanceModal.jsx
// Admin/Manager form to create or edit an attendance record manually.

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { attendanceAPI } from '../../api'
import { parseApiError } from '../../utils/errorUtils'
import Modal from '../ui/Modal'
import { BaseInput, BaseSelect } from '../ui/BaseComponents'
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

// Convert "HH:MM" → total minutes since midnight
function toMins(hhmm) {
  if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return null
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

// Convert "HH:MM" → "9:00 AM" style
function to12hr(hhmm) {
  const mins = toMins(hhmm)
  if (mins === null) return null
  const h = Math.floor(mins / 60)
  const m = mins % 60
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

// Format duration in minutes → "Xh Ym"
function fmtDuration(mins) {
  if (mins === null || mins <= 0) return null
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export default function OverrideAttendanceModal({ open, onClose, editRecord, onSuccess }) {
  const { user } = useAuth()
  const isEdit = !!editRecord

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm({
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
  const duration = (inMins !== null && outMins !== null) ? fmtDuration(outMins - inMins) : null
  const timeError = (inMins !== null && outMins !== null && outMins <= inMins)
    ? 'Check-out must be after check-in'
    : null

  // Populate form when editing
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>

        {/* Employee ID — always auto-filled for the logged-in user */}
        <BaseInput
          label="Employee ID"
          placeholder="e.g. TT0001"
          readOnly
          error={errors.empId?.message}
          {...register('empId', { required: 'Employee ID is required' })}
        />

        {/* Date — auto-filled to today for manual entry and cannot be changed */}
        <BaseInput
          label="Attendance Date"
          type="date"
          readOnly
          error={errors.attendanceDate?.message}
          {...register('attendanceDate', { required: 'Date is required' })}
        />

        {/* Time fields with dual-format preview and duration */}
        <div className="grid-2" style={{ alignItems: 'flex-start' }}>
          <div>
            <BaseInput
              label="Check-in Time (24h)"
              type="time"
              {...register('checkInTime')}
            />
            {checkInTime && to12hr(checkInTime) && (
              <div style={{ fontSize: 12, color: 'var(--success)', marginTop: 4, fontWeight: 600 }}>
                ↳ {to12hr(checkInTime)}
              </div>
            )}
          </div>
          <div>
            <BaseInput
              label="Check-out Time (24h)"
              type="time"
              {...register('checkOutTime')}
            />
            {checkOutTime && to12hr(checkOutTime) && (
              <div style={{
                fontSize: 12,
                color: timeError ? 'var(--danger)' : 'var(--info)',
                marginTop: 4,
                fontWeight: 600,
              }}>
                ↳ {to12hr(checkOutTime)}
              </div>
            )}
          </div>
        </div>

        {/* Duration badge or error */}
        {(duration || timeError) && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', borderRadius: 8,
            background: timeError ? 'var(--danger-light)' : 'var(--info-light)',
            color: timeError ? 'var(--danger)' : 'var(--info)',
            fontSize: 13, fontWeight: 600,
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

        <div className="form-group">
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
