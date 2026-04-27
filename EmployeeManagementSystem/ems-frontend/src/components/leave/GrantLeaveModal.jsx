// src/components/leave/GrantLeaveModal.jsx
// Admin-only modal to directly grant an approved leave for any employee.
// Any overlapping PENDING requests for that employee are auto-rejected by the backend.

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import { leaveAPI } from '../../api'
import { parseApiError } from '../../utils/errorUtils'
import Modal from '../ui/Modal'
import { BaseInput, BaseSelect } from '../ui/BaseComponents'
import toast from 'react-hot-toast'
import { AlertCircle } from 'lucide-react'

const LEAVE_TYPES = [
  { value: 'ANNUAL',       label: 'Annual / Earned Leave'   },
  { value: 'SICK_CASUAL',  label: 'Sick / Casual Leave'     },
  { value: 'UNPAID',       label: 'Unpaid Leave'            },
  { value: 'MATERNITY',    label: 'Maternity Leave'         },
  { value: 'PATERNITY',    label: 'Paternity Leave'         },
  { value: 'COMPENSATORY', label: 'Compensatory Leave'      },
]

function countWorkingDays(start, end) {
  if (!start || !end) return 0
  let count = 0
  const cur = new Date(start)
  const endDate = new Date(end)
  while (cur <= endDate) {
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

export default function GrantLeaveModal({ open, onClose, onSuccess }) {
  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm({
    defaultValues: { empId: '', leaveType: 'ANNUAL', startDate: '', endDate: '', reason: '' },
  })

  const startDate = watch('startDate')
  const endDate   = watch('endDate')
  const days      = countWorkingDays(startDate, endDate)

  useEffect(() => { if (!open) reset() }, [open])

  const mutation = useMutation({
    mutationFn: (data) => leaveAPI.grantLeave(data.empId.trim(), {
      leaveType: data.leaveType,
      startDate: data.startDate,
      endDate:   data.endDate,
      reason:    data.reason || 'Granted by admin',
    }),
    onSuccess: () => {
      toast.success('Leave granted successfully. Any overlapping pending requests were auto-rejected.')
      onSuccess?.()
      onClose()
    },
    onError: (err) => toast.error(parseApiError(err, 'Failed to grant leave')),
  })

  return (
    <Modal open={open} onClose={onClose} title="Grant Leave (Admin)" size="md"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSubmit(d => mutation.mutate(d))}
            disabled={mutation.isPending}>
            {mutation.isPending
              ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Granting…</>
              : 'Grant Leave'}
          </button>
        </>
      }>

      {/* Info banner */}
      <div style={{
        display: 'flex', gap: 10, alignItems: 'flex-start',
        background: 'var(--warning-light)', color: 'var(--warning)',
        padding: '10px 14px', borderRadius: 8, marginBottom: 20, fontSize: 13,
      }}>
        <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          This leave will be <strong>immediately approved</strong>. Any pending requests
          for this employee that overlap these dates will be <strong>auto-rejected</strong>.
        </span>
      </div>

      <BaseInput
        label="Employee ID"
        placeholder="e.g. TT0001"
        required
        error={errors.empId?.message}
        {...register('empId', { required: 'Employee ID is required' })}
      />

      <BaseSelect
        label="Leave Type"
        required
        options={LEAVE_TYPES}
        error={errors.leaveType?.message}
        {...register('leaveType', { required: 'Required' })}
      />

      <div className="grid-2">
        <BaseInput label="Start Date" type="date" required
          error={errors.startDate?.message}
          {...register('startDate', { required: 'Required' })} />
        <BaseInput label="End Date" type="date" required
          error={errors.endDate?.message}
          {...register('endDate', {
            required: 'Required',
            validate: v => !startDate || v >= startDate || 'Must be on or after start date',
          })} />
      </div>

      {days > 0 && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, marginBottom: 16,
          background: 'var(--info-light)', color: 'var(--info)',
          fontSize: 13, fontWeight: 600,
        }}>
          {days} working day{days !== 1 ? 's' : ''} will be granted
        </div>
      )}

      <div className="form-group">
        <label className="form-label">Reason / Notes</label>
        <textarea className="form-input" rows={3}
          placeholder="Reason for granting leave…"
          style={{ resize: 'vertical' }}
          {...register('reason')} />
      </div>
    </Modal>
  )
}
