import { motion } from 'framer-motion'
import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { employeeAPI, roleAPI, authAPI } from '../../api'
import ConfirmDialog from './ConfirmDialog'
import RoleManagement from './RoleManagement'
import { AlertCircle, RefreshCw, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDate } from '../../utils/dateUtils'
import { parseApiError } from '../../utils/errorUtils'
import FocusTrap from 'focus-trap-react'
import { useUIStore } from '../../store/uiStore'

const ALL_ROLES=['ADMIN','MANAGER','EMPLOYEE']
const DEPARTMENTS=['DEVELOPMENT','FINANCE','DESIGN','HR','SALES','MARKETING','SUPPORT','ADMINISTRATION','HOSPITALITY','PROCUREMENT','QUALITY ASSURANCE','TRAINING','SECURITY','MAINTENANCE','CUSTOMER CARE','BUSINESS DEVELOPMENT','STRATEGY','EXECUTIVE LEADERSHIP']
const SKILL_SUGGESTIONS=['JavaScript','TypeScript','React','Angular','Vue.js','Node.js','Python','Java','Spring Boot','SQL','PostgreSQL','MongoDB','Docker','Kubernetes','AWS','Azure','Git','REST APIs','GraphQL','Leadership','Communication','Team Management','Project Management','Problem Solving','Agile','Scrum','Jira','Figma','Photoshop','Accounting','Excel','Power BI','Tableau','SEO','Content Writing','Customer Service','Sales','Negotiation','Training & Development']

export default function EmployeeSideSheet({ empId, isInactiveView, onClose }) {
  const { user, isAdmin, isManager } = useAuth()
  const qc = useQueryClient()
  const { isChatOpen, chatWidth, sideSheetWidth, setSideSheetWidth } = useUIStore()
  const isResizing = useRef(false)

  const startResize = () => { isResizing.current=true; document.addEventListener('mousemove',handleResize); document.addEventListener('mouseup',endResize) }
  const handleResize = (e) => { if(!isResizing.current)return; const rE=isChatOpen?chatWidth:0; const nW=window.innerWidth-e.clientX-rE; if(nW>=400&&nW<=window.innerWidth*0.7)setSideSheetWidth(nW) }
  const endResize = () => { isResizing.current=false; document.removeEventListener('mousemove',handleResize); document.removeEventListener('mouseup',endResize) }

  const [deleteOpen,setDeleteOpen]=useState(false)
  const [assignRoleOpen,setAssignRoleOpen]=useState(false)
  const [removeRoleOpen,setRemoveRoleOpen]=useState(false)
  const [assignRole,setAssignRole]=useState('')
  const [removeRole,setRemoveRole]=useState('')

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['employee',empId,isInactiveView],
    queryFn: ()=>isInactiveView?employeeAPI.getInactiveById(empId):employeeAPI.getById(empId),
    retry: (count,err)=>[403,404].includes(err?.response?.status)?false:count<2,
  })
  const { data: rolesData } = useQuery({
    queryKey: ['employee-roles',empId],
    queryFn: ()=>roleAPI.getRoles(empId),
    enabled: !!empId&&isAdmin()&&!isInactiveView, retry:1,
  })

  const employee=data?.data; const currentRoles=rolesData?.data||[]
  const assignableRoles=ALL_ROLES.filter(r=>!currentRoles.includes(r)); const removableRoles=ALL_ROLES.filter(r=>currentRoles.includes(r))
  const isSelf=user?.empId===employee?.empId
  const canEdit=!isInactiveView&&(isAdmin()||(isManager()&&employee?.department===user?.department)||isSelf)

  const updateMutation=useMutation({
    mutationFn:(updates)=>employeeAPI.update(empId,updates),
    onMutate:async(updates)=>{await qc.cancelQueries({queryKey:['employee',empId,isInactiveView]});const prev=qc.getQueryData(['employee',empId,isInactiveView]);qc.setQueryData(['employee',empId,isInactiveView],old=>old?{...old,data:{...old.data,...updates}}:old);return{prev}},
    onSuccess:()=>{qc.invalidateQueries({queryKey:['employee',empId]});qc.invalidateQueries({queryKey:['employees']})},
    onError:(err,_,ctx)=>{if(ctx?.prev)qc.setQueryData(['employee',empId,isInactiveView],ctx.prev);toast.error(parseApiError(err,'Failed to update'))}
  })
  const patch=(field)=>async(val)=>await updateMutation.mutateAsync({[field]:val})
  const patchArray=(field)=>async(arr)=>await updateMutation.mutateAsync({[field]:arr.join(', ')})
  const splitCsv=(str)=>str?.split(',').map(s=>s.trim()).filter(Boolean)||[]

  const deleteMutation=useMutation({mutationFn:()=>employeeAPI.delete(empId),onSuccess:()=>{toast.success('Employee deactivated');qc.invalidateQueries({queryKey:['employees']});setDeleteOpen(false);onClose()},onError:(err)=>toast.error(parseApiError(err,'Failed to deactivate'))})
  const assignMutation=useMutation({mutationFn:(role)=>roleAPI.assign(empId,role),onSuccess:()=>{toast.success('Role assigned');qc.invalidateQueries({queryKey:['employee-roles',empId]});setAssignRoleOpen(false);setAssignRole('')},onError:(err)=>toast.error(parseApiError(err,'Failed to assign role'))})
  const removeMutation=useMutation({mutationFn:(role)=>roleAPI.remove(empId,role),onSuccess:()=>{toast.success('Role removed');qc.invalidateQueries({queryKey:['employee-roles',empId]});setRemoveRoleOpen(false);setRemoveRole('')},onError:(err)=>toast.error(parseApiError(err,'Failed to remove role'))})
  const resetPwdMutation=useMutation({mutationFn:()=>authAPI.resetPassword(empId),onSuccess:()=>toast.success('Temporary password sent'),onError:(err)=>toast.error(parseApiError(err,'Failed to reset password'))})

  const sheetStyle={position:'fixed',top:'var(--topnav-height)',right:isChatOpen?chatWidth:0,bottom:0,width:`${sideSheetWidth}px`,maxWidth:'90vw',zIndex:1050,borderLeft:'1px solid var(--border)',transition:'right 0.3s ease'}

  if (isLoading) return (
    <motion.div initial={{x:'100%',opacity:0}} animate={{x:0,opacity:1}} exit={{x:'100%',opacity:0}} transition={{type:'spring',damping:25,stiffness:200}} className="glass-panel" style={{...sheetStyle,display:'flex',justifyContent:'center',alignItems:'center'}}>
      <div className="spinner" style={{width:32,height:32}}/>
    </motion.div>
  )

  if (error||!employee) {
    const status=error?.response?.status; const message=status===404?'Employee not found.':status===403?'You do not have permission to view this employee.':parseApiError(error,'Failed to load employee details.')
    return (
      <FocusTrap focusTrapOptions={{initialFocus:false,escapeDeactivates:false,clickOutsideDeactivates:true}}>
        <motion.div role="dialog" aria-modal="true" initial={{x:'100%',opacity:0}} animate={{x:0,opacity:1}} exit={{x:'100%',opacity:0}} transition={{type:'spring',damping:25,stiffness:200}} className="glass-panel" style={{...sheetStyle,padding:40,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
          <div className="empty-state"><AlertCircle size={40} style={{color:'var(--danger)'}}/><h3>Could not load employee</h3><p style={{fontSize:14,color:'var(--text-secondary)',maxWidth:320,textAlign:'center'}}>{message}</p>
            <div style={{display:'flex',gap:10}}><button className="btn btn-secondary btn-sm" onClick={()=>refetch()}><RefreshCw size={14}/> Retry</button><button className="btn btn-secondary btn-sm" onClick={onClose}><X size={14}/> Close</button></div>
          </div>
        </motion.div>
      </FocusTrap>
    )
  }

  const initials=employee.name?.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()||'??'
  const departments=splitCsv(employee.department); const designations=splitCsv(employee.designation); const skills=splitCsv(employee.skills)

  return (
    <FocusTrap focusTrapOptions={{initialFocus:false,escapeDeactivates:false,clickOutsideDeactivates:true}}>
      <motion.div role="dialog" aria-modal="true" aria-label={`${employee.name} details`} initial={{x:'100%',opacity:0}} animate={{x:0,opacity:1}} exit={{x:'100%',opacity:0}} transition={{type:'spring',damping:25,stiffness:200}} className="glass-panel" style={{...sheetStyle,display:'flex',flexDirection:'column',overflowY:'hidden',boxShadow:'-8px 0 32px rgba(0,0,0,0.15)'}}>
        <div onMouseDown={startResize} tabIndex={0} role="separator" aria-label="Resize panel" aria-orientation="vertical" onKeyDown={e=>{if(e.key==='ArrowLeft')setSideSheetWidth(w=>Math.min(w+20,window.innerWidth*0.7));if(e.key==='ArrowRight')setSideSheetWidth(w=>Math.max(w-20,400))}} style={{position:'absolute',left:0,top:0,bottom:0,width:8,cursor:'ew-resize',zIndex:20}} className="resize-handle"/>
        <div style={{flexShrink:0,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 24px',borderBottom:'1px solid var(--border)',background:'var(--bg-card)'}}>
          <h2 style={{fontSize:16,fontWeight:700,margin:0,display:'flex',alignItems:'center',gap:10}}>
            <span style={{width:8,height:8,borderRadius:'50%',background:isInactiveView?'var(--danger)':'var(--success)',boxShadow:`0 0 8px ${isInactiveView?'var(--danger)':'var(--success)'}`}}/>
            Employee Profile
          </h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} title="Close" style={{padding:6}}><X size={16}/></button>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'24px'}}>
          {/* Hero card */}
          <div className="card" style={{marginBottom:20}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:16}}>
              <div style={{display:'flex',alignItems:'center',gap:20}}>
                <div className="avatar avatar-xl" style={{background:isInactiveView?'var(--bg-tertiary)':'var(--accent-light)',color:isInactiveView?'var(--text-muted)':'var(--accent)',fontSize:28}}>{initials}</div>
                <div>
                  <h2 style={{fontSize:22,marginBottom:4}}>{employee.name}</h2>
                  <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginTop:4}}>
                    {departments.map(d=><span key={d} className={`badge ${isInactiveView?'badge-neutral':'badge-info'}`}>{d}</span>)}
                    {isInactiveView&&<span className="badge badge-danger" style={{display:'flex',alignItems:'center',gap:4}}>Deactivated</span>}
                  </div>
                  {!isInactiveView&&<div style={{marginTop:8,display:'flex',gap:6,flexWrap:'wrap'}}>
                    {currentRoles.length>0?currentRoles.map(r=><span key={r} className={`badge role-${r.toLowerCase()}`}>{r}</span>):<span className="badge badge-neutral">No roles</span>}
                  </div>}
                </div>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="grid-2" style={{marginBottom:20}}>
            <div className="card">
              <h3 className="card-title" style={{marginBottom:16}}>Contact Information</h3>
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                {[['Company Email',employee.companyEmail],['Personal Email',employee.personalEmail],['Phone',employee.phoneNumber],['Address',employee.address]].map(([label,val])=>(
                  <div key={label}><div style={{fontSize:12,color:'var(--text-muted)',marginBottom:2}}>{label}</div><div style={{fontSize:14,fontWeight:500}}>{val||'—'}</div></div>
                ))}
              </div>
            </div>
            <div className="card">
              <h3 className="card-title" style={{marginBottom:16}}>Employment Details</h3>
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                {[['Employee ID',employee.empId],['Department',departments.join(', ')],['Designation',designations.join(', ')],['Date of Joining',formatDate(employee.dateOfJoin)],['Date of Birth',formatDate(employee.dateOfBirth)]].map(([label,val])=>(
                  <div key={label}><div style={{fontSize:12,color:'var(--text-muted)',marginBottom:2}}>{label}</div><div style={{fontSize:14,fontWeight:500}}>{val||'—'}</div></div>
                ))}
                {isInactiveView&&employee.dateOfExit&&<div><div style={{fontSize:12,color:'var(--danger)',marginBottom:2}}>Date of Exit</div><div style={{fontSize:14,fontWeight:500,color:'var(--danger)'}}>{formatDate(employee.dateOfExit)}</div></div>}
              </div>
            </div>
          </div>

          {skills.length>0&&<div className="card" style={{marginBottom:20}}>
            <h3 className="card-title" style={{marginBottom:12}}>Skills</h3>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{skills.map(s=><span key={s} className="skill-chip">{s}</span>)}</div>
          </div>}

          {employee.description&&<div className="card" style={{marginBottom:20}}>
            <h3 className="card-title" style={{marginBottom:12}}>Description</h3>
            <p style={{color:'var(--text-secondary)',lineHeight:1.7}}>{employee.description}</p>
          </div>}

          {!isInactiveView&&isAdmin()&&!isSelf&&(
            <RoleManagement empId={empId} currentRoles={currentRoles} allRoles={ALL_ROLES}
              onAssign={role=>assignMutation.mutate(role)} onRemove={role=>removeMutation.mutate(role)}
              assignOpen={assignRoleOpen} setAssignOpen={setAssignRoleOpen}
              removeOpen={removeRoleOpen} setRemoveOpen={setRemoveRoleOpen}
              assignRole={assignRole} setAssignRole={setAssignRole}
              removeRole={removeRole} setRemoveRole={setRemoveRole}
              loading={assignMutation.isPending||removeMutation.isPending}/>
          )}

          {isAdmin()&&!isInactiveView&&!isSelf&&(
            <div style={{marginTop:20,display:'flex',gap:10,flexWrap:'wrap'}}>
              <button className="btn btn-secondary btn-sm" onClick={()=>resetPwdMutation.mutate()} disabled={resetPwdMutation.isPending}>
                {resetPwdMutation.isPending?<span className="spinner" style={{width:13,height:13}}/>:null} Reset Password
              </button>
              <button className="btn btn-danger btn-sm" onClick={()=>setDeleteOpen(true)}>Deactivate</button>
            </div>
          )}

          {!isInactiveView&&!isSelf&&(
            <ConfirmDialog open={deleteOpen} onClose={()=>setDeleteOpen(false)} onConfirm={()=>deleteMutation.mutate()}
              title="Deactivate Employee" message={`Are you sure you want to deactivate ${employee.name}? They will lose system access immediately.`}
              confirmLabel="Deactivate" danger loading={deleteMutation.isPending}/>
          )}
        </div>
      </motion.div>
    </FocusTrap>
  )
}
