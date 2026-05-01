import { motion } from 'framer-motion'
import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { employeeAPI, roleAPI, authAPI } from '../../api'
import ConfirmDialog from './ConfirmDialog'
import RoleManagement from './RoleManagement'
import { AlertCircle, RefreshCw, X, Pencil, Check, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDate } from '../../utils/dateUtils'
import { parseApiError } from '../../utils/errorUtils'
import FocusTrap from 'focus-trap-react'
import { useUIStore } from '../../store/uiStore'

const ALL_ROLES = ['ADMIN', 'MANAGER', 'EMPLOYEE']
const DEPARTMENTS = ['DEVELOPMENT','FINANCE','DESIGN','HR','SALES','MARKETING','SUPPORT','ADMINISTRATION','HOSPITALITY','PROCUREMENT','QUALITY ASSURANCE','TRAINING','SECURITY','MAINTENANCE','CUSTOMER CARE','BUSINESS DEVELOPMENT','STRATEGY','EXECUTIVE LEADERSHIP']
const SKILL_SUGGESTIONS = ['JavaScript','TypeScript','React','Angular','Vue.js','Node.js','Python','Java','Spring Boot','SQL','PostgreSQL','MongoDB','Docker','Kubernetes','AWS','Azure','Git','REST APIs','GraphQL','Leadership','Communication','Team Management','Project Management','Problem Solving','Agile','Scrum','Jira','Figma','Photoshop','Accounting','Excel','Power BI','Tableau','SEO','Content Writing','Customer Service','Sales','Negotiation','Training & Development']
const GENDERS = ['MALE', 'FEMALE', 'OTHER']

export default function EmployeeSideSheet({ empId, isInactiveView, onClose }) {
  const { user, isAdmin, isManager } = useAuth()
  const qc = useQueryClient()
  const { isChatOpen, chatWidth, sideSheetWidth, setSideSheetWidth } = useUIStore()
  const isResizing = useRef(false)

  const startResize = () => { isResizing.current = true; document.addEventListener('mousemove', handleResize); document.addEventListener('mouseup', endResize) }
  const handleResize = (e) => { if (!isResizing.current) return; const rE = isChatOpen ? chatWidth : 0; const nW = window.innerWidth - e.clientX - rE; if (nW >= 400 && nW <= window.innerWidth * 0.7) setSideSheetWidth(nW) }
  const endResize = () => { isResizing.current = false; document.removeEventListener('mousemove', handleResize); document.removeEventListener('mouseup', endResize) }

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [assignRoleOpen, setAssignRoleOpen] = useState(false)
  const [removeRoleOpen, setRemoveRoleOpen] = useState(false)
  const [assignRole, setAssignRole] = useState('')
  const [removeRole, setRemoveRole] = useState('')

  // ── Edit mode state ────────────────────────────────────────────────────────
  const [editMode, setEditMode] = useState(false)
  const [draft, setDraft] = useState(null)
  const [skillInput, setSkillInput] = useState('')
  const [showSkillSugg, setShowSkillSugg] = useState(false)
  const skillInputRef = useRef(null)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['employee', empId, isInactiveView],
    queryFn: () => isInactiveView ? employeeAPI.getInactiveById(empId) : employeeAPI.getById(empId),
    retry: (count, err) => [403, 404].includes(err?.response?.status) ? false : count < 2,
  })
  const { data: rolesData } = useQuery({
    queryKey: ['employee-roles', empId],
    queryFn: () => roleAPI.getRoles(empId),
    enabled: !!empId && isAdmin() && !isInactiveView, retry: 1,
  })

  const employee = data?.data
  const currentRoles = rolesData?.data || employee?.roles || []
  const assignableRoles = ALL_ROLES.filter(r => !currentRoles.includes(r))
  const removableRoles = ALL_ROLES.filter(r => currentRoles.includes(r))
  const isSelf = user?.empId === employee?.empId
  const canEdit = !isInactiveView && (isAdmin() || (isManager() && employee?.department === user?.department) || isSelf)

  const updateMutation = useMutation({
    mutationFn: (updates) => employeeAPI.update(empId, updates),
    onMutate: async (updates) => {
      await qc.cancelQueries({ queryKey: ['employee', empId, isInactiveView] })
      const prev = qc.getQueryData(['employee', empId, isInactiveView])
      qc.setQueryData(['employee', empId, isInactiveView], old => old ? { ...old, data: { ...old.data, ...updates } } : old)
      return { prev }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee', empId] })
      qc.invalidateQueries({ queryKey: ['employees'] })
    },
    onError: (err, _, ctx) => {
      if (ctx?.prev) qc.setQueryData(['employee', empId, isInactiveView], ctx.prev)
      toast.error(parseApiError(err, 'Failed to update'))
    },
  })

  const splitCsv = (str) => str?.split(',').map(s => s.trim()).filter(Boolean) || []

  const deleteMutation = useMutation({ mutationFn: () => employeeAPI.delete(empId), onSuccess: () => { toast.success('Employee deactivated'); qc.invalidateQueries({ queryKey: ['employees'] }); setDeleteOpen(false); onClose() }, onError: (err) => toast.error(parseApiError(err, 'Failed to deactivate')) })
  const assignMutation = useMutation({ mutationFn: (role) => roleAPI.assign(empId, role), onSuccess: () => { toast.success('Role assigned'); qc.invalidateQueries({ queryKey: ['employee-roles', empId] }); setAssignRoleOpen(false); setAssignRole('') }, onError: (err) => toast.error(parseApiError(err, 'Failed to assign role')) })
  const removeMutation = useMutation({ mutationFn: (role) => roleAPI.remove(empId, role), onSuccess: () => { toast.success('Role removed'); qc.invalidateQueries({ queryKey: ['employee-roles', empId] }); setRemoveRoleOpen(false); setRemoveRole('') }, onError: (err) => toast.error(parseApiError(err, 'Failed to remove role')) })
  const resetPwdMutation = useMutation({ mutationFn: () => authAPI.resetPassword(empId), onSuccess: () => toast.success('Temporary password sent'), onError: (err) => toast.error(parseApiError(err, 'Failed to reset password')) })

  // ── Edit helpers ───────────────────────────────────────────────────────────
  const startEdit = () => {
    setDraft({
      name: employee.name || '',
      personalEmail: employee.personalEmail || '',
      phoneNumber: employee.phoneNumber || '',
      address: employee.address || '',
      department: employee.department || '',
      designation: employee.designation || '',
      gender: employee.gender || '',
      description: employee.description || '',
      skills: employee.skills || '',
    })
    setEditMode(true)
  }

  const cancelEdit = () => { setEditMode(false); setDraft(null); setSkillInput(''); setShowSkillSugg(false) }

  const saveEdit = async () => {
    if (!draft.name?.trim()) { toast.error('Name is required'); return }
    try {
      await updateMutation.mutateAsync(draft)
      toast.success('Employee updated successfully')
      setEditMode(false)
      setDraft(null)
    } catch { /* handled by mutation */ }
  }

  const setField = (field) => (e) => setDraft(d => ({ ...d, [field]: e.target.value }))

  // Draft skill helpers
  const draftSkills = draft?.skills ? splitCsv(draft.skills) : []
  const addSkill = (skill) => {
    const s = skill.trim()
    if (!s || draftSkills.includes(s)) return
    setDraft(d => ({ ...d, skills: [...draftSkills, s].join(', ') }))
    setSkillInput('')
    setShowSkillSugg(false)
  }
  const removeSkill = (skill) => setDraft(d => ({ ...d, skills: draftSkills.filter(s => s !== skill).join(', ') }))

  // Draft department helpers
  const draftDepts = draft?.department ? splitCsv(draft.department) : []
  const addDept = (dept) => {
    if (!dept || draftDepts.includes(dept)) return
    setDraft(d => ({ ...d, department: [...draftDepts, dept].join(', ') }))
  }
  const removeDept = (dept) => setDraft(d => ({ ...d, department: draftDepts.filter(d2 => d2 !== dept).join(', ') }))

  const filteredSkillSugg = SKILL_SUGGESTIONS.filter(s =>
    skillInput.length > 0 &&
    s.toLowerCase().includes(skillInput.toLowerCase()) &&
    !draftSkills.includes(s)
  ).slice(0, 6)

  const sheetStyle = { position: 'fixed', top: 'var(--topnav-height)', right: isChatOpen ? chatWidth : 0, bottom: 0, width: `${sideSheetWidth}px`, maxWidth: '90vw', zIndex: 1050, borderLeft: '1px solid var(--border)', transition: 'right 0.3s ease' }

  if (isLoading) return (
    <motion.div initial={{ x: '100%', opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: '100%', opacity: 0 }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="glass-panel" style={{ ...sheetStyle, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div className="spinner" style={{ width: 32, height: 32 }} />
    </motion.div>
  )

  if (error || !employee) {
    const status = error?.response?.status
    const message = status === 404 ? 'Employee not found.' : status === 403 ? 'You do not have permission to view this employee.' : parseApiError(error, 'Failed to load employee details.')
    return (
      <FocusTrap focusTrapOptions={{ initialFocus: false, escapeDeactivates: false, clickOutsideDeactivates: true }}>
        <motion.div role="dialog" aria-modal="true" initial={{ x: '100%', opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: '100%', opacity: 0 }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="glass-panel" style={{ ...sheetStyle, padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div className="empty-state"><AlertCircle size={40} style={{ color: 'var(--danger)' }} /><h3>Could not load employee</h3><p style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 320, textAlign: 'center' }}>{message}</p>
            <div style={{ display: 'flex', gap: 10 }}><button className="btn btn-secondary btn-sm" onClick={() => refetch()}><RefreshCw size={14} /> Retry</button><button className="btn btn-secondary btn-sm" onClick={onClose}><X size={14} /> Close</button></div>
          </div>
        </motion.div>
      </FocusTrap>
    )
  }

  const initials = employee.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??'
  const departments = splitCsv(employee.department)
  const designations = splitCsv(employee.designation)
  const skills = splitCsv(employee.skills)

  return (
    <FocusTrap focusTrapOptions={{ initialFocus: false, escapeDeactivates: false, clickOutsideDeactivates: true }}>
      <motion.div role="dialog" aria-modal="true" aria-label={`${employee.name} details`} initial={{ x: '100%', opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: '100%', opacity: 0 }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="glass-panel" style={{ ...sheetStyle, display: 'flex', flexDirection: 'column', overflowY: 'hidden', boxShadow: '-8px 0 32px rgba(0,0,0,0.15)' }}>
        <div onMouseDown={startResize} tabIndex={0} role="separator" aria-label="Resize panel" aria-orientation="vertical" onKeyDown={e => { if (e.key === 'ArrowLeft') setSideSheetWidth(w => Math.min(w + 20, window.innerWidth * 0.7)); if (e.key === 'ArrowRight') setSideSheetWidth(w => Math.max(w - 20, 400)) }} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 8, cursor: 'ew-resize', zIndex: 20 }} className="resize-handle" />

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: isInactiveView ? 'var(--danger)' : 'var(--success)', boxShadow: `0 0 8px ${isInactiveView ? 'var(--danger)' : 'var(--success)'}` }} />
            {editMode ? 'Edit Employee' : 'Employee Profile'}
          </h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {canEdit && !editMode && (
              <button className="btn btn-secondary btn-sm" onClick={startEdit} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Pencil size={13} /> Edit
              </button>
            )}
            {editMode && (
              <>
                <button className="btn btn-secondary btn-sm" onClick={cancelEdit} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <X size={13} /> Cancel
                </button>
                <button className="btn btn-primary btn-sm" onClick={saveEdit} disabled={updateMutation.isPending} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {updateMutation.isPending ? <span className="spinner" style={{ width: 13, height: 13 }} /> : <Check size={13} />}
                  Save
                </button>
              </>
            )}
            {!editMode && <button className="btn btn-ghost btn-sm" onClick={onClose} title="Close" style={{ padding: 6 }}><X size={16} /></button>}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* VIEW MODE                                                          */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {!editMode && (
            <>
              {/* Hero card */}
              <div className="card" style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <div className="avatar avatar-xl" style={{ background: isInactiveView ? 'var(--bg-tertiary)' : 'var(--accent-light)', color: isInactiveView ? 'var(--text-muted)' : 'var(--accent)', fontSize: 28 }}>{initials}</div>
                    <div>
                      <h2 style={{ fontSize: 22, marginBottom: 4 }}>{employee.name}</h2>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                        {departments.map(d => <span key={d} className={`badge ${isInactiveView ? 'badge-neutral' : 'badge-info'}`}>{d}</span>)}
                        {isInactiveView && <span className="badge badge-danger" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Deactivated</span>}
                      </div>
                      {!isInactiveView && <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {currentRoles.length > 0 ? currentRoles.map(r => <span key={r} className={`badge role-${r.toLowerCase()}`}>{r}</span>) : <span className="badge badge-neutral">No roles</span>}
                      </div>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Details */}
              <div className="grid-2" style={{ marginBottom: 20 }}>
                <div className="card">
                  <h3 className="card-title" style={{ marginBottom: 16 }}>Contact Information</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[['Company Email', employee.companyEmail], ['Personal Email', employee.personalEmail], ['Phone', employee.phoneNumber], ['Address', employee.address]].map(([label, val]) => (
                      <div key={label}><div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div><div style={{ fontSize: 14, fontWeight: 500 }}>{val || '—'}</div></div>
                    ))}
                  </div>
                </div>
                <div className="card">
                  <h3 className="card-title" style={{ marginBottom: 16 }}>Employment Details</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[['Employee ID', employee.empId], ['Department', departments.join(', ')], ['Designation', designations.join(', ')], ['Gender', employee.gender], ['Date of Joining', formatDate(employee.dateOfJoin)], ['Date of Birth', formatDate(employee.dateOfBirth)]].map(([label, val]) => (
                      <div key={label}><div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div><div style={{ fontSize: 14, fontWeight: 500 }}>{val || '—'}</div></div>
                    ))}
                    {isInactiveView && employee.dateOfExit && <div><div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 2 }}>Date of Exit</div><div style={{ fontSize: 14, fontWeight: 500, color: 'var(--danger)' }}>{formatDate(employee.dateOfExit)}</div></div>}
                  </div>
                </div>
              </div>

              {skills.length > 0 && <div className="card" style={{ marginBottom: 20 }}>
                <h3 className="card-title" style={{ marginBottom: 12 }}>Skills</h3>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{skills.map(s => <span key={s} className="skill-chip">{s}</span>)}</div>
              </div>}

              {employee.description && <div className="card" style={{ marginBottom: 20 }}>
                <h3 className="card-title" style={{ marginBottom: 12 }}>Description</h3>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>{employee.description}</p>
              </div>}

              {!isInactiveView && isAdmin() && !isSelf && (
                <RoleManagement empId={empId} currentRoles={currentRoles} allRoles={ALL_ROLES}
                  onAssign={role => assignMutation.mutate(role)} onRemove={role => removeMutation.mutate(role)}
                  assignOpen={assignRoleOpen} setAssignOpen={setAssignRoleOpen}
                  removeOpen={removeRoleOpen} setRemoveOpen={setRemoveRoleOpen}
                  assignRole={assignRole} setAssignRole={setAssignRole}
                  removeRole={removeRole} setRemoveRole={setRemoveRole}
                  loading={assignMutation.isPending || removeMutation.isPending} />
              )}

              {isAdmin() && !isInactiveView && !isSelf && (
                <div style={{ marginTop: 20, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => resetPwdMutation.mutate()} disabled={resetPwdMutation.isPending}>
                    {resetPwdMutation.isPending ? <span className="spinner" style={{ width: 13, height: 13 }} /> : null} Reset Password
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => setDeleteOpen(true)}>Deactivate</button>
                </div>
              )}

              {!isInactiveView && !isSelf && (
                <ConfirmDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={() => deleteMutation.mutate()}
                  title="Deactivate Employee" message={`Are you sure you want to deactivate ${employee.name}? They will lose system access immediately.`}
                  confirmLabel="Deactivate" danger loading={deleteMutation.isPending} />
              )}
            </>
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* EDIT MODE                                                          */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {editMode && draft && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Basic Info */}
              <div className="card">
                <h3 className="card-title" style={{ marginBottom: 16 }}>Basic Information</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={labelStyle}>Full Name <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input className="form-input" value={draft.name} onChange={setField('name')} placeholder="Full name" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Gender</label>
                    <select className="form-input" value={draft.gender} onChange={setField('gender')} style={inputStyle}>
                      <option value="">— Select gender —</option>
                      {GENDERS.map(g => <option key={g} value={g}>{g.charAt(0) + g.slice(1).toLowerCase()}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Contact */}
              <div className="card">
                <h3 className="card-title" style={{ marginBottom: 16 }}>Contact Information</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={labelStyle}>Company Email</label>
                    <input className="form-input" value={employee.companyEmail} disabled style={{ ...inputStyle, opacity: 0.5, cursor: 'not-allowed' }} />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, display: 'block' }}>Company email cannot be changed</span>
                  </div>
                  <div>
                    <label style={labelStyle}>Personal Email</label>
                    <input className="form-input" type="email" value={draft.personalEmail} onChange={setField('personalEmail')} placeholder="personal@email.com" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Phone Number</label>
                    <input className="form-input" type="tel" value={draft.phoneNumber} onChange={setField('phoneNumber')} placeholder="+91 00000 00000" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Address</label>
                    <textarea className="form-input" value={draft.address} onChange={setField('address')} placeholder="Full address" rows={3} style={{ ...inputStyle, resize: 'vertical', minHeight: 72 }} />
                  </div>
                </div>
              </div>

              {/* Employment */}
              <div className="card">
                <h3 className="card-title" style={{ marginBottom: 16 }}>Employment Details</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                  {/* Department multi-select */}
                  <div>
                    <label style={labelStyle}>Department</label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: draftDepts.length ? 8 : 0 }}>
                      {draftDepts.map(d => (
                        <span key={d} style={chipStyle}>
                          {d}
                          <button type="button" onClick={() => removeDept(d)} style={chipXStyle} aria-label={`Remove ${d}`}><X size={10} /></button>
                        </span>
                      ))}
                    </div>
                    <select className="form-input" value="" onChange={e => { addDept(e.target.value); e.target.value = '' }} style={inputStyle}>
                      <option value="">+ Add department</option>
                      {DEPARTMENTS.filter(d => !draftDepts.includes(d)).map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>

                  {/* Designation */}
                  <div>
                    <label style={labelStyle}>Designation</label>
                    <input className="form-input" value={draft.designation} onChange={setField('designation')} placeholder="e.g. Senior Developer, Team Lead" style={inputStyle} />
                  </div>

                  {/* Read-only fields */}
                  <div className="grid-2" style={{ gap: 14 }}>
                    <div>
                      <label style={labelStyle}>Employee ID</label>
                      <input className="form-input" value={employee.empId} disabled style={{ ...inputStyle, opacity: 0.5, cursor: 'not-allowed' }} />
                    </div>
                    <div>
                      <label style={labelStyle}>Date of Joining</label>
                      <input className="form-input" value={formatDate(employee.dateOfJoin)} disabled style={{ ...inputStyle, opacity: 0.5, cursor: 'not-allowed' }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Skills */}
              <div className="card">
                <h3 className="card-title" style={{ marginBottom: 16 }}>Skills</h3>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: draftSkills.length ? 10 : 0 }}>
                  {draftSkills.map(s => (
                    <span key={s} style={chipStyle}>
                      {s}
                      <button type="button" onClick={() => removeSkill(s)} style={chipXStyle} aria-label={`Remove ${s}`}><X size={10} /></button>
                    </span>
                  ))}
                </div>
                <div style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      ref={skillInputRef}
                      className="form-input"
                      value={skillInput}
                      onChange={e => { setSkillInput(e.target.value); setShowSkillSugg(true) }}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(skillInput) } if (e.key === 'Escape') setShowSkillSugg(false) }}
                      onFocus={() => setShowSkillSugg(true)}
                      onBlur={() => setTimeout(() => setShowSkillSugg(false), 150)}
                      placeholder="Type a skill and press Enter"
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => addSkill(skillInput)} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Plus size={13} /> Add
                    </button>
                  </div>
                  {showSkillSugg && filteredSkillSugg.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 100, marginTop: 4, overflow: 'hidden' }}>
                      {filteredSkillSugg.map(s => (
                        <button key={s} type="button" onMouseDown={() => addSkill(s)}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)' }}
                          onMouseEnter={e => e.target.style.background = 'var(--bg-tertiary)'}
                          onMouseLeave={e => e.target.style.background = 'none'}>
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              <div className="card">
                <h3 className="card-title" style={{ marginBottom: 16 }}>Description</h3>
                <textarea className="form-input" value={draft.description} onChange={setField('description')} placeholder="Brief description about the employee..." rows={4} style={{ ...inputStyle, resize: 'vertical', minHeight: 96 }} />
              </div>

              {/* Save / Cancel (bottom) */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingBottom: 8 }}>
                <button className="btn btn-secondary" onClick={cancelEdit}>Cancel</button>
                <button className="btn btn-primary" onClick={saveEdit} disabled={updateMutation.isPending} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {updateMutation.isPending ? <span className="spinner" style={{ width: 15, height: 15 }} /> : <Check size={15} />}
                  Save Changes
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </FocusTrap>
  )
}

// ── Shared inline styles ─────────────────────────────────────────────────────
const labelStyle = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-secondary)',
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: '0.6px',
}

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
}

const chipStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '4px 10px',
  borderRadius: 20,
  background: 'var(--accent-light)',
  color: 'var(--accent)',
  fontSize: 12,
  fontWeight: 500,
}

const chipXStyle = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 0,
  display: 'flex',
  alignItems: 'center',
  color: 'inherit',
  opacity: 0.7,
}
