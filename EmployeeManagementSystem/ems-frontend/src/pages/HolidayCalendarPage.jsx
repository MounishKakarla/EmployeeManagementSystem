// src/pages/HolidayCalendarPage.jsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { useForm } from 'react-hook-form'
import { parseApiError } from '../utils/errorUtils'
import Modal from '../components/ui/Modal'
import { BaseInput } from '../components/ui/BaseComponents'
import { CalendarDays, Plus, Trash2, Pencil, Sun, Eraser } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../api'
import useDocumentTitle from '../hooks/useDocumentTitle'
import '../styles/holiday.css'

// inline API calls since holidayAPI is a small set
const holidayAPI = {
  getByYear:     (year)    => api.get('/ems/holidays', { params: { year } }),
  add:           (data)    => api.post('/ems/holidays', data),
  update:        (id, d)   => api.put(`/ems/holidays/${id}`, d),
  delete:        (id)      => api.delete(`/ems/holidays/${id}`),
  deleteByYear:  (year)    => api.delete(`/ems/holidays/year/${year}`),
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAY_LABELS  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

export default function HolidayCalendarPage() {
  const { isAdmin } = useAuth()
  useDocumentTitle('Holiday Calendar | TekSphere')
  const qc  = useQueryClient()
  const now = new Date()
  const currentYear = now.getFullYear()

  const [year,       setYear]       = useState(currentYear)
  const [addOpen,    setAddOpen]    = useState(false)
  const [editRecord, setEditRecord] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['holidays', year],
    queryFn: () => holidayAPI.getByYear(year),
  })
  const holidays = data?.data || []

  // Build a Set of holiday date strings for fast lookup
  const holidaySet = new Set(holidays.map(h => h.holidayDate))

  const deleteMutation = useMutation({
    mutationFn: (id) => holidayAPI.delete(id),
    onSuccess: () => { toast.success('Holiday removed'); qc.invalidateQueries({ queryKey: ['holidays'] }) },
    onError:   (e)  => toast.error(parseApiError(e, 'Failed to delete')),
  })

  const clearAllMutation = useMutation({
    mutationFn: () => holidayAPI.deleteByYear(year),
    onSuccess: (res) => {
      toast.success(res.data || `All holidays for ${year} cleared`)
      qc.invalidateQueries({ queryKey: ['holidays'] })
      qc.invalidateQueries({ queryKey: ['attendance'] })
    },
    onError: (e) => toast.error(parseApiError(e, 'Failed to clear holidays')),
  })

  return (
    <div className="holiday-page">
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CalendarDays size={26} color="var(--accent)" /> Holiday Calendar
          </h1>
          <p className="page-subtitle">
            Weekends (Sat & Sun) are always non-working. Public holidays are managed here.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <select className="form-select" value={year} style={{ width: 160 }}
            onChange={e => setYear(Number(e.target.value))}>
            {Array.from({ length: 106 }, (_, index) => currentYear - 5 + index).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          {isAdmin() && (
            <>
              {holidays.length > 0 && (
                <button
                  className="btn btn-danger btn-sm"
                  disabled={clearAllMutation.isPending}
                  onClick={() => {
                    if (window.confirm(`Remove all ${holidays.length} holiday(s) for ${year}? This cannot be undone.`))
                      clearAllMutation.mutate()
                  }}
                >
                  <Eraser size={14} /> Clear All
                </button>
              )}
              <button className="btn btn-primary btn-sm" onClick={() => setAddOpen(true)}>
                <Plus size={14} /> Add Holiday
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Holiday Management Layout ────────────────────────────────────────── */}
      <div className="holiday-container" style={{ display: 'grid', gridTemplateColumns: isAdmin() ? '320px 1fr' : '1fr', gap: 24, alignItems: 'start' }}>
        
        {/* Left Side: Add Holiday Form (Admins Only) */}
        {isAdmin() && (
          <div className="card" style={{ padding: 20 }}>
            <h3 className="card-title" style={{ marginBottom: 16 }}>Add New Holiday</h3>
            <HolidayForm 
              onSuccess={() => {
                qc.invalidateQueries({ queryKey: ['holidays'] })
                qc.invalidateQueries({ queryKey: ['attendance'] })
              }}
            />
          </div>
        )}

        {/* Right Side: Holiday List */}
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="card-title">{year} Public Holidays ({holidays.length})</h3>
            {!isAdmin() && holidays.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No holidays found.</p>}
          </div>

          {isLoading ? (
            <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><div className="spinner" /></div>
          ) : holidays.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <Sun size={32} color="var(--text-muted)" style={{ marginBottom: 12 }} />
              <p style={{ color: 'var(--text-muted)' }}>No holidays defined for {year}.</p>
            </div>
          ) : (
            <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Name</th>
                    <th className="desktop-only">Description</th>
                    {isAdmin() && <th style={{ width: 80 }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {holidays.map(h => (
                    <tr key={h.id}>
                      <td style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>
                        {new Date(h.holidayDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', weekday: 'short' })}
                      </td>
                      <td style={{ fontWeight: 500, fontSize: 14 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          {h.name}
                          <span className={`badge ${h.isMandatory ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: 10, padding: '2px 6px' }}>
                            {h.isMandatory ? 'Mandatory' : 'Optional'}
                          </span>
                        </div>
                      </td>
                      <td className="desktop-only" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{h.description || '—'}</td>
                      {isAdmin() && (
                        <td>
                          <button 
                            className="btn btn-ghost btn-sm" 
                            onClick={() => {
                              if(window.confirm('Remove this holiday?')) deleteMutation.mutate(h.id)
                            }}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 size={14} color="var(--danger)" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>


      {holidays.length === 0 && !isLoading && (
        <div className="empty-state card">
          <Sun size={36} />
          <h3>No public holidays defined for {year}</h3>
          {isAdmin() && <button className="btn btn-primary btn-sm" onClick={() => setAddOpen(true)}>
            <Plus size={14} /> Add First Holiday
          </button>}
        </div>
      )}

      <HolidayModal
        open={addOpen || !!editRecord}
        editRecord={editRecord}
        onClose={() => { setAddOpen(false); setEditRecord(null) }}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ['holidays'] })
          qc.invalidateQueries({ queryKey: ['attendance'] })
        }}
      />
    </div>
  )
}

// ── Standalone Holiday Form (Inline) ──────────────────────────────────────────
function HolidayForm({ onSuccess }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: { holidayDate: '', name: '', description: '', isMandatory: true },
  })

  const mutation = useMutation({
    mutationFn: (data) => holidayAPI.add(data),
    onSuccess: () => {
      toast.success('Holiday added')
      onSuccess?.(); reset()
    },
    onError: (e) => toast.error(parseApiError(e, 'Failed to save holiday')),
  })

  return (
    <div className="holiday-inline-form" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <BaseInput label="Date" type="date" required
        error={errors.holidayDate?.message}
        {...register('holidayDate', { required: 'Date is required' })} />
      <BaseInput label="Holiday Name" placeholder="e.g. Republic Day" required
        error={errors.name?.message}
        {...register('name', { required: 'Name is required' })} />
      
      <div className="form-group">
        <label className="form-label">Description</label>
        <textarea className="form-input" rows={2} placeholder="Optional..."
          style={{ resize:'none' }} {...register('description')} />
      </div>

      <div className="form-group" style={{ display:'flex', alignItems:'center', gap:10 }}>
        <input type="checkbox" id="mandatory" {...register('isMandatory')}
          style={{ width:16, height:16 }} />
        <label htmlFor="mandatory" style={{ fontSize:13, cursor:'pointer', fontWeight: 500 }}>
          Mandatory Holiday
        </label>
      </div>

      <button 
        className="btn btn-primary" 
        style={{ width: '100%', marginTop: 8 }}
        onClick={handleSubmit(d => mutation.mutate(d))}
        disabled={mutation.isPending}
      >
        {mutation.isPending ? <div className="spinner" style={{ width: 14, height: 14 }} /> : <><Plus size={16} /> Add Holiday</>}
      </button>
    </div>
  )
}

// ── Add/Edit modal (Keeping for potential legacy or edit uses) ────────────────
function HolidayModal({ open, editRecord, onClose, onSuccess }) {
  const isEdit = !!editRecord
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: { holidayDate: '', name: '', description: '', isMandatory: true },
  })

  const mutation = useMutation({
    mutationFn: (data) => isEdit
      ? holidayAPI.update(editRecord.id, data)
      : holidayAPI.add(data),
    onSuccess: () => {
      toast.success(isEdit ? 'Holiday updated' : 'Holiday added')
      onSuccess?.(); onClose(); reset()
    },
    onError: (e) => toast.error(parseApiError(e, 'Failed to save holiday')),
  })

  return (
    <Modal open={open} onClose={() => { onClose(); reset() }}
      title={isEdit ? 'Edit Holiday' : 'Add Public Holiday'} size="sm"
      footer={
        <>
          <button className="btn btn-secondary" onClick={() => { onClose(); reset() }}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit(d => mutation.mutate(d))}
            disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : isEdit ? 'Update' : 'Add Holiday'}
          </button>
        </>
      }>
      <BaseInput label="Date" type="date" required
        error={errors.holidayDate?.message}
        {...register('holidayDate', { required: 'Date is required' })} />
      <BaseInput label="Holiday Name" placeholder="e.g. Republic Day" required
        error={errors.name?.message}
        {...register('name', { required: 'Name is required' })} />
      <div className="form-group">
        <label className="form-label">Description (optional)</label>
        <textarea className="form-input" rows={2} placeholder="Brief description…"
          style={{ resize:'vertical' }} {...register('description')} />
      </div>
      <div className="form-group" style={{ display:'flex', alignItems:'center', gap:10 }}>
        <input type="checkbox" id="mandatory" {...register('isMandatory')}
          style={{ width:16, height:16 }} />
        <label htmlFor="mandatory" style={{ fontSize:14, cursor:'pointer' }}>
          Mandatory
        </label>
      </div>
    </Modal>
  )
}

