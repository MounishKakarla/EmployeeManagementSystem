// src/pages/HolidayCalendarPage.jsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { useForm } from 'react-hook-form'
import { parseApiError } from '../utils/errorUtils'
import Modal from '../components/ui/Modal'
import { BaseInput } from '../components/ui/BaseComponents'
import { CalendarDays, Plus, Trash2, Pencil, Sun } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../api'
import useDocumentTitle from '../hooks/useDocumentTitle'
import '../styles/holiday.css'

// inline API calls since holidayAPI is a small set
const holidayAPI = {
  getByYear:  (year)    => api.get('/ems/holidays', { params: { year } }),
  add:        (data)    => api.post('/ems/holidays', data),
  update:     (id, d)   => api.put(`/ems/holidays/${id}`, d),
  delete:     (id)      => api.delete(`/ems/holidays/${id}`),
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAY_LABELS  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

export default function HolidayCalendarPage() {
  const { isAdmin } = useAuth()
  useDocumentTitle('Holiday Calendar | Tektalis EMS')
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
            <button className="btn btn-primary btn-sm" onClick={() => setAddOpen(true)}>
              <Plus size={14} /> Add Holiday
            </button>
          )}
        </div>
      </div>

      {/* ── Year grid ──────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div style={{ padding: 60, display: 'flex', justifyContent: 'center' }}>
          <div className="spinner" style={{ width: 28, height: 28 }} />
        </div>
      ) : (
        <div className="holiday-year-grid">
          {Array.from({ length: 12 }, (_, month) => (
            <MonthCard
              key={month}
              month={month}
              year={year}
              holidaySet={holidaySet}
              holidays={holidays.filter(h => {
                const d = new Date(h.holidayDate)
                return d.getMonth() === month && d.getFullYear() === year
              })}
              isAdmin={isAdmin()}
              onEdit={r => setEditRecord(r)}
              onDelete={id => deleteMutation.mutate(id)}
            />
          ))}
        </div>
      )}

      {/* ── Holiday list ───────────────────────────────────────────────────────── */}
      {holidays.length > 0 && (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
            <h3 className="card-title">{year} Public Holidays ({holidays.length})</h3>
          </div>
          <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
            <table>
              <thead>
                <tr><th>Date</th><th>Name</th><th>Description</th><th>Type</th>
                  {isAdmin() && <th>Actions</th>}</tr>
              </thead>
              <tbody>
                {holidays.map(h => (
                  <tr key={h.id}>
                    <td style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>
                      {new Date(h.holidayDate).toLocaleDateString('en-IN',
                        { day: '2-digit', month: 'short', year: 'numeric', weekday: 'short' })}
                    </td>
                    <td style={{ fontWeight: 500, fontSize: 14 }}>{h.name}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{h.description || '—'}</td>
                    <td>
                      <span className={`badge ${h.isMandatory ? 'badge-danger' : 'badge-warning'}`}
                        style={{ fontSize: 11 }}>
                        {h.isMandatory ? 'Mandatory' : 'Optional'}
                      </span>
                    </td>
                    {isAdmin() && (
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-ghost btn-sm"
                            onClick={() => setEditRecord(h)}>
                            <Pencil size={12} />
                          </button>
                          <button className="btn btn-ghost btn-sm"
                            onClick={() => deleteMutation.mutate(h.id)}
                            disabled={deleteMutation.isPending}>
                            <Trash2 size={12} color="var(--danger)" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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

// ── Mini month calendar card ───────────────────────────────────────────────────
function MonthCard({ month, year, holidaySet, holidays, isAdmin, onEdit, onDelete }) {
  const firstDay = new Date(year, month, 1).getDay()
  const lastDate = new Date(year, month + 1, 0).getDate()
  const today    = new Date().toISOString().split('T')[0]

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= lastDate; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    const dow     = new Date(year, month, d).getDay()
    cells.push({ d, dateStr, isWeekend: dow === 0 || dow === 6,
      isHoliday: holidaySet.has(dateStr), isToday: dateStr === today })
  }

  return (
    <div className="card month-card">
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: 'var(--text-primary)' }}>
        {MONTH_NAMES[month]}
      </div>
      <div className="month-grid">
        {DAY_LABELS.map(d => (
          <div key={d} style={{ textAlign:'center', fontSize:10, color:'var(--text-muted)',
            fontWeight:600, paddingBottom:4 }}>{d}</div>
        ))}
        {cells.map((c, i) => !c ? <div key={`e${i}`} /> : (
          <div key={c.dateStr} title={c.isHoliday
            ? holidays.find(h => h.holidayDate === c.dateStr)?.name : undefined}
            style={{
              textAlign:'center', fontSize:11, lineHeight:'24px', height:24, borderRadius:4,
              background: c.isToday ? 'var(--accent)'
                : c.isHoliday ? 'var(--danger-light)'
                : c.isWeekend ? 'var(--bg-tertiary)' : 'transparent',
              color: c.isToday ? 'white'
                : c.isHoliday ? 'var(--danger)'
                : c.isWeekend ? 'var(--text-muted)' : 'var(--text-primary)',
              fontWeight: c.isToday || c.isHoliday ? 700 : 400,
              cursor: c.isHoliday ? 'pointer' : 'default',
            }}
          >{c.d}</div>
        ))}
      </div>
      {holidays.length > 0 && (
        <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          {holidays.map(h => (
            <div key={h.id} style={{ fontSize: 11, color: 'var(--danger)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 2 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                flex: 1, marginRight: 4 }}>
                {new Date(h.holidayDate).getDate()} — {h.name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Add/Edit modal ─────────────────────────────────────────────────────────────
function HolidayModal({ open, editRecord, onClose, onSuccess }) {
  const qc     = useQueryClient()
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
            {mutation.isPending
              ? <><span className="spinner" style={{ width:14, height:14 }} /> Saving…</>
              : isEdit ? 'Update' : 'Add Holiday'}
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
          Mandatory (applies to all employees)
        </label>
      </div>
    </Modal>
  )
}
