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

export default function OverrideAttendanceModal({ open, onClose, editRecord, onSuccess }) {
  const { user } = useAuth()
  const isEdit = !!editRecord

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: {
      empId:          user?.empId || '',
      attendanceDate: new Date().toISOString().split('T')[0],
      checkInTime:    '',
      checkOutTime:   '',
      status:         'PRESENT',
      notes:          '',
    },
  })

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
          <button className="btn btn-primary" onClick={handleSubmit(d => mutation.mutate(d))}
            disabled={mutation.isPending}>
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

        <div className="grid-2">
          <BaseInput
            label="Check-in Time"
            type="time"
            {...register('checkInTime')}
          />
          <BaseInput
            label="Check-out Time"
            type="time"
            {...register('checkOutTime')}
          />
        </div>

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
