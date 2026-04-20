import { useState } from 'react'
import { Mail, Phone, MapPin, Building2, Briefcase, Calendar, User, Check, X, Pencil, Star } from 'lucide-react'
import TagInput from '../ui/Taginput'

export function InlineField({ label, icon: Icon, value, onSave, disabled, multiline, danger }) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(value||'')
  const [saving,  setSaving]  = useState(false)

  const handleSave = async () => {
    if (draft===value) { setEditing(false); return }
    setSaving(true)
    try { await onSave(draft); setEditing(false) }
    catch {}
    finally { setSaving(false) }
  }

  const iconColor = danger?'var(--danger)':'var(--text-muted)'
  const iconBg    = danger?'var(--danger-light)':'var(--bg-tertiary)'

  return (
    <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
      <div style={{ width:32, height:32, flexShrink:0, marginTop:2, background:iconBg, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <Icon size={14} color={iconColor}/>
      </div>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:12, color:danger?'var(--danger)':'var(--text-muted)', marginBottom:3 }}>{label}</div>
        {disabled ? (
          <div style={{ fontSize:14, fontWeight:500, color:'var(--text-muted)', padding:'2px 0', wordBreak:'break-all' }}>{value||<span style={{ fontStyle:'italic', fontWeight:400 }}>—</span>}</div>
        ) : editing ? (
          <div style={{ display:'flex', gap:6, alignItems:'flex-start' }}>
            {multiline
              ? <textarea className="form-input" value={draft} onChange={e=>setDraft(e.target.value)} rows={2} autoFocus style={{ fontSize:13, resize:'vertical', padding:'6px 10px' }}/>
              : <input className="form-input" value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')handleSave();if(e.key==='Escape'){setDraft(value||'');setEditing(false)}}} autoFocus style={{ fontSize:13, padding:'6px 10px' }}/>}
            <button onClick={handleSave} disabled={saving} className="btn btn-primary btn-sm" style={{ padding:'6px 10px', flexShrink:0 }}>
              {saving?<span className="spinner" style={{ width:12, height:12 }}/>:<Check size={12}/>}
            </button>
            <button onClick={()=>{setDraft(value||'');setEditing(false)}} className="btn btn-secondary btn-sm" style={{ padding:'6px 10px', flexShrink:0 }}><X size={12}/></button>
          </div>
        ) : (
          <div className="inline-field-row">
            <span style={{ fontSize:14, fontWeight:500, wordBreak:'break-all', color:danger?'var(--danger)':'var(--text-primary)' }}>{value||<span style={{ color:'var(--text-muted)', fontStyle:'italic', fontWeight:400 }}>—</span>}</span>
            <button onClick={()=>{setDraft(value||'');setEditing(true)}} className="inline-edit-btn" style={{ background:'none', border:'none', cursor:'pointer', opacity:0, padding:2, flexShrink:0 }} title={`Edit ${label}`}><Pencil size={11} color="var(--text-muted)"/></button>
          </div>
        )}
      </div>
    </div>
  )
}

export function InlineSelectField({ label, icon: Icon, value, onSave, disabled, options, danger }) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(value||'')
  const [saving,  setSaving]  = useState(false)

  const handleSave = async () => {
    if (draft===value) { setEditing(false); return }
    setSaving(true)
    try { await onSave(draft); setEditing(false) }
    catch {}
    finally { setSaving(false) }
  }

  const iconColor = danger?'var(--danger)':'var(--text-muted)'
  const iconBg    = danger?'var(--danger-light)':'var(--bg-tertiary)'

  return (
    <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
      <div style={{ width:32, height:32, flexShrink:0, marginTop:2, background:iconBg, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <Icon size={14} color={iconColor}/>
      </div>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:12, color:danger?'var(--danger)':'var(--text-muted)', marginBottom:3 }}>{label}</div>
        {disabled ? (
          <div style={{ fontSize:14, fontWeight:500, color:'var(--text-muted)', padding:'2px 0', wordBreak:'break-all' }}>{value||<span style={{ fontStyle:'italic', fontWeight:400 }}>—</span>}</div>
        ) : editing ? (
          <div style={{ display:'flex', gap:6, alignItems:'flex-start' }}>
            <select className="form-input" value={draft} onChange={e=>setDraft(e.target.value)} style={{ fontSize:13, padding:'6px 10px' }}>
              <option value="">{label}...</option>
              {options.map(o=><option key={o} value={o}>{o}</option>)}
            </select>
            <button onClick={handleSave} disabled={saving} className="btn btn-primary btn-sm" style={{ padding:'6px 10px', flexShrink:0 }}>
              {saving?<span className="spinner" style={{ width:12, height:12 }}/>:<Check size={12}/>}
            </button>
            <button onClick={()=>{setDraft(value||'');setEditing(false)}} className="btn btn-secondary btn-sm" style={{ padding:'6px 10px', flexShrink:0 }}><X size={12}/></button>
          </div>
        ) : (
          <div className="inline-field-row">
            <span style={{ fontSize:14, fontWeight:500, wordBreak:'break-all', color:danger?'var(--danger)':'var(--text-primary)' }}>{value||<span style={{ color:'var(--text-muted)', fontStyle:'italic', fontWeight:400 }}>—</span>}</span>
            <button onClick={()=>{setDraft(value||'');setEditing(true)}} className="inline-edit-btn" style={{ background:'none', border:'none', cursor:'pointer', opacity:0, padding:2, flexShrink:0 }} title={`Edit ${label}`}><Pencil size={11} color="var(--text-muted)"/></button>
          </div>
        )}
      </div>
    </div>
  )
}

export function DetailItem({ icon: Icon, label, value, danger }) {
  return (
    <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
      <div style={{ width:32, height:32, flexShrink:0, background:danger?'var(--danger-light)':'var(--bg-tertiary)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <Icon size={14} color={danger?'var(--danger)':'var(--text-muted)'}/>
      </div>
      <div>
        <div style={{ fontSize:12, color:danger?'var(--danger)':'var(--text-muted)', marginBottom:2 }}>{label}</div>
        <div style={{ fontSize:14, fontWeight:500, color:danger?'var(--danger)':'inherit' }}>{value||'—'}</div>
      </div>
    </div>
  )
}

export function MultiValueField({ icon: Icon, label, values, onChange, suggestions, chipColor, badgeClass, canEdit, allowCustom }) {
  return (
    <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
      <div style={{ width:32, height:32, background:'var(--bg-tertiary)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:2 }}><Icon size={14} color="var(--text-muted)"/></div>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:6 }}>{label}</div>
        {canEdit
          ? <TagInput values={values} onChange={onChange} suggestions={suggestions} placeholder={`Search or add ${label.toLowerCase()}…`} chipColor={chipColor} allowCustom={allowCustom}/>
          : <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {values.length>0 ? values.map(v=><span key={v} className={`badge ${badgeClass}`}>{v}</span>) : <span style={{ fontSize:14, fontWeight:500, color:'var(--text-muted)' }}>—</span>}
            </div>}
      </div>
    </div>
  )
}

const DEPARTMENTS = ['DEVELOPMENT','FINANCE','DESIGN','HR','SALES','MARKETING','SUPPORT','ADMINISTRATION','HOSPITALITY','PROCUREMENT','QUALITY ASSURANCE','TRAINING','SECURITY','MAINTENANCE','CUSTOMER CARE','BUSINESS DEVELOPMENT','STRATEGY','EXECUTIVE LEADERSHIP']
const SKILL_SUGGESTIONS = ['JavaScript','TypeScript','React','Angular','Vue.js','Node.js','Python','Java','Spring Boot','SQL','PostgreSQL','MongoDB','Docker','Kubernetes','AWS','Azure','Git','REST APIs','GraphQL','Leadership','Communication','Team Management','Project Management','Agile','Scrum']

export default function ContactInfo({ employee, canEdit, isInactiveView, patch, patchArray, departments, designations, skills, formatDate }) {
  return (
    <>
      <div className="grid-2">
        <div className="card">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
            <h3 className="card-title">Contact Information</h3>
            {canEdit && <span style={{ fontSize:11, color:'var(--text-muted)' }}>Click value to edit</span>}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
            <InlineField icon={Mail}   label="Company Email"  value={employee.companyEmail} disabled/>
            <InlineField icon={Mail}   label="Personal Email" value={employee.personalEmail} onSave={patch('personalEmail')} disabled={!canEdit}/>
            <InlineField icon={Phone}  label="Phone"          value={employee.phoneNumber}   onSave={patch('phoneNumber')}   disabled={!canEdit}/>
            <InlineField icon={MapPin} label="Address"        value={employee.address}        onSave={patch('address')}       disabled={!canEdit} multiline/>
            <InlineSelectField icon={User} label="Gender"     value={employee.gender}         onSave={patch('gender')}        disabled={!canEdit} options={['MALE','FEMALE','OTHER']}/>
          </div>
        </div>
        <div className="card">
          <h3 className="card-title" style={{ marginBottom:20 }}>Employment Details</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
            <DetailItem icon={User} label="Employee ID" value={employee.empId}/>
            <MultiValueField icon={Building2} label={`Department${departments.length!==1?'s':''}`} values={departments} onChange={canEdit?async(vals)=>{try{await patchArray('department')(vals)}catch{}}:null} suggestions={DEPARTMENTS} chipColor="info" badgeClass="badge-info" canEdit={canEdit} allowCustom={false}/>
            <MultiValueField icon={Briefcase} label={`Designation${designations.length!==1?'s':''}`} values={designations} onChange={canEdit?async(vals)=>{try{await patchArray('designation')(vals)}catch{}}:null} suggestions={[]} chipColor="accent" badgeClass="badge-accent" canEdit={canEdit} allowCustom/>
            <DetailItem icon={Calendar} label="Date of Joining" value={formatDate(employee.dateOfJoin)}/>
            {employee.dateOfBirth && <DetailItem icon={Calendar} label="Date of Birth" value={formatDate(employee.dateOfBirth)}/>}
            {isInactiveView && employee.dateOfExit && <DetailItem icon={Calendar} label="Date of Exit" value={formatDate(employee.dateOfExit)} danger/>}
          </div>
        </div>
      </div>
      <div className="card">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:32, height:32, background:'var(--success-light)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center' }}><Star size={14} color="var(--success)"/></div>
            <h3 className="card-title" style={{ margin:0 }}>Skills</h3>
          </div>
          {canEdit && <span style={{ fontSize:11, color:'var(--text-muted)' }}>Type to search or add custom skills</span>}
        </div>
        {canEdit
          ? <TagInput values={skills} onChange={async(vals)=>{try{await patchArray('skills')(vals)}catch{}}} suggestions={SKILL_SUGGESTIONS} placeholder="Search or add skills…" chipColor="success" allowCustom/>
          : <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {skills.length>0 ? skills.map(s=><span key={s} className="skill-chip">{s}</span>) : <span style={{ color:'var(--text-muted)', fontSize:14, fontStyle:'italic' }}>No skills recorded.</span>}
            </div>}
      </div>
      <div className="card">
        <h3 className="card-title" style={{ marginBottom:14 }}>Description / Notes</h3>
        {canEdit
          ? <InlineField icon={User} label="" value={employee.description} onSave={patch('description')} disabled={false} multiline/>
          : <p style={{ color:employee.description?'var(--text-secondary)':'var(--text-muted)', lineHeight:1.7, fontStyle:employee.description?'normal':'italic' }}>{employee.description||'No description available.'}</p>}
      </div>
    </>
  )
}
