// src/components/leave/RequestLeaveModal.jsx
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import { leaveAPI } from '../../api'
import { parseApiError } from '../../utils/errorUtils'
import Modal from '../ui/Modal'
import { BaseInput, BaseSelect } from '../ui/BaseComponents'
import toast from 'react-hot-toast'

const LEAVE_TYPES = [
  { value: 'ANNUAL',       label: 'Annual Leave'       },
  { value: 'SICK',         label: 'Sick Leave'         },
  { value: 'CASUAL',       label: 'Casual Leave'       },
  { value: 'UNPAID',       label: 'Unpaid Leave'       },
  { value: 'MATERNITY',    label: 'Maternity Leave'    },
  { value: 'PATERNITY',    label: 'Paternity Leave'    },
  { value: 'COMPENSATORY', label: 'Compensatory Leave' },
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

export default function RequestLeaveModal({ open, onClose, balance, onSuccess }) {
  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm({
    defaultValues: { leaveType: 'ANNUAL', startDate: '', endDate: '', reason: '' },
  })

  const startDate  = watch('startDate')
  const endDate    = watch('endDate')
  const leaveType  = watch('leaveType')
  const days       = countWorkingDays(startDate, endDate)

  // Remaining for selected type
  const remaining = balance ? (
    leaveType === 'ANNUAL'  ? (balance.annualRemaining ?? balance.remainingAnnual)  :
    leaveType === 'SICK'    ? (balance.sickRemaining   ?? balance.remainingSick)    :
    leaveType === 'CASUAL'  ? (balance.casualRemaining ?? balance.remainingCasual)  :
    leaveType === 'MATERNITY' ? balance.maternityRemaining :
    leaveType === 'PATERNITY' ? balance.paternityRemaining :
    leaveType === 'COMPENSATORY' ? balance.compOffRemaining : null
  ) : null

  useEffect(() => { if (!open) reset() }, [open])

  const mutation = useMutation({
    mutationFn: (data) => leaveAPI.submit({
      leaveType:  data.leaveType,
      startDate:  data.startDate,
      endDate:    data.endDate,
      reason:     data.reason,
    }),
    onSuccess: () => {
      toast.success('Leave request submitted!')
      onSuccess?.()
      onClose()
    },
    onError: (err) => toast.error(parseApiError(err, 'Failed to submit leave')),
  })

  return (
    <Modal open={open} onClose={onClose} title="Request Leave" size="md"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={mutation.isPending}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit(d => mutation.mutate(d))}
            disabled={mutation.isPending || (remaining !== null && days > remaining)}>
            {mutation.isPending
              ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Submitting…</>
              : 'Submit Request'}
          </button>
        </>
      }>

      <BaseSelect label="Leave Type" required options={LEAVE_TYPES.filter(t => {
        if (t.value === 'MATERNITY' && balance?.maternityTotal == null) return false;
        if (t.value === 'PATERNITY' && balance?.paternityTotal == null) return false;
        return true;
      })}
        error={errors.leaveType?.message}
        {...register('leaveType', { required: 'Required' })} />

      <div className="grid-2">
        <BaseInput label="Start Date" type="date" required
          error={errors.startDate?.message}
          {...register('startDate', {
            required: 'Required',
            validate: v => v >= new Date().toISOString().split('T')[0] || 'Cannot be in the past',
          })} />
        <BaseInput label="End Date" type="date" required
          error={errors.endDate?.message}
          {...register('endDate', {
            required: 'Required',
            validate: v => !startDate || v >= startDate || 'Must be on or after start date',
          })} />
      </div>

      {/* Days preview */}
      {days > 0 && (
        <div style={{
          padding: '12px 16px', borderRadius: 8, marginBottom: 16,
          background: remaining !== null && days > remaining
            ? 'var(--danger-light)' : 'var(--success-light)',
          color: remaining !== null && days > remaining
            ? 'var(--danger)' : 'var(--success)',
          fontSize: 13, fontWeight: 600,
        }}>
          {days} working day{days !== 1 ? 's' : ''} requested
          {remaining !== null && (
            <span style={{ fontWeight: 400, marginLeft: 8 }}>
              · {remaining} available{days > remaining ? ' — insufficient balance!' : ''}
            </span>
          )}
        </div>
      )}

      <div className="form-group">
        <label className="form-label">Reason</label>
        <textarea className="form-input" rows={3} placeholder="Brief reason for leave…"
          style={{ resize: 'vertical' }} {...register('reason')} />
      </div>
    </Modal>
  )
}
