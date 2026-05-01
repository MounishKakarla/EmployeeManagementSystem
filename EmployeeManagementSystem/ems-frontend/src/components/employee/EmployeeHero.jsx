import { useState } from 'react'
import { Check, X, Pencil, UserX, ShieldPlus, ShieldMinus, RotateCcw, Trash2 } from 'lucide-react'

export function InlineEditableName({ value, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(value)
  const [saving,  setSaving]  = useState(false)
  const [hovered, setHovered] = useState(false)

  const handleSave = async () => {
    if (draft.trim()===value||!draft.trim()) return setEditing(false)
    setSaving(true)
    try { await onSave(draft.trim()); setEditing(false) }
    finally { setSaving(false) }
  }

  if (editing) return (
    <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:4 }}>
      <input className="form-input" value={draft} onChange={e=>setDraft(e.target.value)}
        onKeyDown={e=>{if(e.key==='Enter')handleSave();if(e.key==='Escape')setEditing(false)}}
        autoFocus style={{ fontSize:20, fontWeight:700, padding:'4px 10px' }}/>
      <button onClick={handleSave} disabled={saving} className="btn btn-primary btn-sm" style={{ padding:'6px 10px' }}>
        {saving?<span className="spinner" style={{ width:12, height:12 }}/>:<Check size={12}/>}
      </button>
      <button onClick={()=>setEditing(false)} className="btn btn-secondary btn-sm" style={{ padding:'6px 10px' }}><X size={12}/></button>
    </div>
  )

  return (
    <h2 onClick={()=>{setDraft(value);setEditing(true)}} onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}
      title="Click to edit name"
      style={{ fontSize:22, marginBottom:4, cursor:'pointer', color:hovered?'var(--accent)':'var(--text-primary)', transition:'color 0.15s', display:'inline-flex', alignItems:'center', gap:8 }}>
      {value}
      <Pencil size={13} color="var(--text-muted)" style={{ opacity:hovered?0.7:0.25, transition:'opacity 0.15s' }}/>
    </h2>
  )
}

export default function EmployeeHero({ employee, initials, departments, currentRoles, canEdit, isAdmin, isInactiveView, isSelf, assignableRoles, removableRoles, resetPwdMutation, patch, setAssignRole, setAssignRoleOpen, setRemoveRole, setRemoveRoleOpen, setDeleteOpen }) {
  if (!employee) return null
  return (
    <div className="card">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:20 }}>
          {employee.profileImage ? (
            <img src={employee.profileImage} alt={employee.name} style={{ width:64, height:64, borderRadius:'50%', objectFit:'cover', border:'3px solid var(--border)', flexShrink:0 }}/>
          ) : (
            <div className="avatar avatar-xl" style={{ background:isInactiveView?'var(--bg-tertiary)':'var(--accent-light)', color:isInactiveView?'var(--text-muted)':'var(--accent)', fontSize:28 }}>{initials}</div>
          )}
          <div>
            {canEdit ? <InlineEditableName value={employee.name} onSave={patch('name')}/> : <h2 style={{ fontSize:22, marginBottom:4 }}>{employee.name}</h2>}
            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginTop:4 }}>
              {departments.map(d=><span key={d} className={`badge ${isInactiveView?'badge-neutral':'badge-info'}`}>{d}</span>)}
              {isInactiveView && <span className="badge badge-danger" style={{ display:'flex', alignItems:'center', gap:4 }}><UserX size={11}/> Deactivated</span>}
            </div>
            {!isInactiveView && (
              <div style={{ marginTop:8, display:'flex', gap:6, flexWrap:'wrap' }}>
                {currentRoles.length>0 ? currentRoles.map(r=><span key={r} className={`badge role-${r.toLowerCase()}`}>{r}</span>) : <span className="badge badge-neutral">No roles assigned</span>}
              </div>
            )}
          </div>
        </div>

        {canEdit && isAdmin() && (
          <div className="detail-hero-actions">
            {/* Role assignment/removal only available when viewing ANOTHER employee's profile.
                An admin cannot assign or revoke their own roles — another admin must do it. */}
            {!isSelf && (
              <>
                <button className="btn btn-secondary btn-sm" onClick={()=>{setAssignRole('');setAssignRoleOpen(true)}} disabled={assignableRoles.length===0}><ShieldPlus size={13}/> Assign Role</button>
                <button className="btn btn-secondary btn-sm" onClick={()=>{setRemoveRole('');setRemoveRoleOpen(true)}} disabled={removableRoles.length===0}><ShieldMinus size={13}/> Remove Role</button>
              </>
            )}
            {isSelf && (
              <div className="self-warning" style={{ display:'flex', alignItems:'center', gap:6, color:'var(--warning)', fontSize:12 }}>
                <ShieldPlus size={13}/> Role changes must be done by another Admin
              </div>
            )}
            {/* Reset password only for other employees */}
            {!isSelf && (
              <button className="btn btn-secondary btn-sm" onClick={()=>resetPwdMutation.mutate()} disabled={resetPwdMutation.isPending}>
                {resetPwdMutation.isPending?<span className="spinner" style={{ width:13, height:13 }}/>:<RotateCcw size={13}/>}
                {resetPwdMutation.isPending?'Sending…':'Reset Password'}
              </button>
            )}
            {!isSelf && <button className="btn btn-danger btn-sm" onClick={()=>setDeleteOpen(true)}><Trash2 size={13}/> Deactivate</button>}
            {isSelf && <div className="self-warning">You cannot deactivate your own account</div>}
          </div>
        )}

        {isInactiveView && (
          <div style={{ padding:'8px 16px', background:'var(--danger-light)', borderRadius:8, fontSize:13, color:'var(--danger)', display:'flex', alignItems:'center', gap:6 }}>
            <UserX size={14}/> Read-only — account deactivated
          </div>
        )}
      </div>
    </div>
  )
}