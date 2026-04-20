import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { X, ArrowLeft, CheckCircle, AlertCircle, User, Mail, Phone, MapPin, Building2, Briefcase, Calendar, Star, FileText } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { employeeAPI } from '../../api'
import { useUIStore } from '../../store/uiStore'
import { formatDate } from '../../utils/dateUtils'
import { parseApiError } from '../../utils/errorUtils'
import { BaseInput, BaseTextarea, BaseSelect, FormField } from './BaseComponents'
import TagInput from './Taginput'
import ResumeUploadButton from './ResumeUploadButton'
import FocusTrap from 'focus-trap-react'
import toast from 'react-hot-toast'

const DEPARTMENTS=['DEVELOPMENT','FINANCE','DESIGN','HR','SALES','MARKETING','SUPPORT','ADMINISTRATION','HOSPITALITY','PROCUREMENT','QUALITY ASSURANCE','TRAINING','SECURITY','MAINTENANCE','CUSTOMER CARE','BUSINESS DEVELOPMENT','STRATEGY','EXECUTIVE LEADERSHIP']
const SKILL_SUGGESTIONS=['JavaScript','TypeScript','React','Node.js','Python','Java','Spring Boot','SQL','PostgreSQL','MongoDB','Docker','AWS','Git','Leadership','Communication','Agile','Scrum','Figma','Excel','Power BI']
const ROLES=['ADMIN','MANAGER','EMPLOYEE']
const STEPS=['Personal Info','Employment & Skills','Roles','Review']
const STEP_FIELDS=[['name','personalEmail','companyEmail','phoneNumber','address','gender'],['dateOfJoin','dateOfBirth'],[],[]]

export default function NewEmployeeSheet({ onClose }) {
  const queryClient=useQueryClient()
  const { isChatOpen, chatWidth, sideSheetWidth, setSideSheetWidth }=useUIStore()
  const isResizing=useRef(false)
  const startResize=()=>{isResizing.current=true;document.addEventListener('mousemove',handleResize);document.addEventListener('mouseup',endResize)}
  const handleResize=(e)=>{if(!isResizing.current)return;const rE=isChatOpen?chatWidth:0;const nW=window.innerWidth-e.clientX-rE;if(nW>=400&&nW<=window.innerWidth*0.7)setSideSheetWidth(nW)}
  const endResize=()=>{isResizing.current=false;document.removeEventListener('mousemove',handleResize);document.removeEventListener('mouseup',endResize)}

  const [step,setStep]=useState(0); const [roles,setRoles]=useState(['EMPLOYEE']); const [submitted,setSubmitted]=useState(false)
  const [departments,setDepartments]=useState([]); const [designations,setDesignations]=useState([]); const [skills,setSkills]=useState([])
  const { register, trigger, getValues, setValue, formState:{errors} }=useForm({ defaultValues:{name:'',personalEmail:'',companyEmail:'',phoneNumber:'',address:'',gender:'',dateOfJoin:'',dateOfBirth:'',description:''} })

  const handleResumeData=(data)=>{
    if(!data)return
    const fullName=[data.fName,data.lName].filter(Boolean).join(' ')
    if(fullName)setValue('name',fullName,{shouldValidate:true})
    if(data.pEmail)setValue('personalEmail',data.pEmail,{shouldValidate:true})
    if(data.phoneNumber)setValue('phoneNumber',data.phoneNumber,{shouldValidate:true})
    if(data.dob)setValue('dateOfBirth',data.dob,{shouldValidate:true})
    if(Array.isArray(data.skills)&&data.skills.length>0){const n=data.skills.map(s=>s.trim()).filter(Boolean);setSkills(prev=>{const ex=new Set(prev.map(s=>s.toLowerCase()));return[...prev,...n.filter(s=>!ex.has(s.toLowerCase()))]})}
  }

  const mutation=useMutation({
    mutationFn:(data)=>employeeAPI.create(data),
    onSuccess:(res)=>{queryClient.invalidateQueries({queryKey:['employees']});toast.success(`Employee ${res.data.name} (${res.data.empId}) created! Credentials sent via email.`,{duration:5000});onClose()},
    onError:(err)=>{toast.error(parseApiError(err,'Failed to create employee'));setSubmitted(false)},
  })

  const nextStep=async()=>{
    const valid=await trigger(STEP_FIELDS[step]); if(!valid)return
    if(step===1){if(departments.length===0){toast.error('Add at least one department');return};if(designations.length===0){toast.error('Add at least one designation');return}}
    if(step===2&&roles.length===0){toast.error('Assign at least one role');return}
    setStep(s=>s+1)
  }
  const handleCreate=()=>{if(submitted)return;setSubmitted(true);mutation.mutate({...getValues(),department:departments.join(','),designation:designations.join(','),skills:skills.join(','),roles})}
  const toggleRole=(role)=>setRoles(prev=>prev.includes(role)?prev.filter(r=>r!==role):[...prev,role])
  const values=getValues(); const isSubmitting=mutation.isPending||submitted

  return (
    <FocusTrap focusTrapOptions={{initialFocus:false,escapeDeactivates:false,clickOutsideDeactivates:true}}>
      <motion.div role="dialog" aria-modal="true" aria-label="Create New Employee" initial={{x:'100%',opacity:0}} animate={{x:0,opacity:1}} exit={{x:'100%',opacity:0}} transition={{type:'spring',damping:25,stiffness:200}} className="glass-panel"
        style={{position:'fixed',top:'var(--topnav-height)',right:isChatOpen?chatWidth:0,bottom:0,width:`${sideSheetWidth}px`,maxWidth:'90vw',zIndex:1050,borderLeft:'1px solid var(--border)',display:'flex',flexDirection:'column',overflowY:'hidden',background:'var(--bg-card)',transition:'right 0.3s ease'}}>
        <div onMouseDown={startResize} style={{position:'absolute',left:0,top:0,bottom:0,width:6,cursor:'ew-resize',zIndex:20}} className="resize-handle"/>
        <div style={{flexShrink:0,padding:'16px 20px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center',background:'var(--bg-card)'}}>
          <h2 style={{fontSize:16,fontWeight:700,margin:0,display:'flex',alignItems:'center',gap:10}}>
            <span style={{width:8,height:8,borderRadius:'50%',background:'var(--accent)',boxShadow:'0 0 8px var(--accent)'}}/>
            Add New Employee
          </h2>
          <button onClick={onClose} className="btn-icon"><X size={16}/></button>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'24px'}}>
          <div className="card" style={{marginBottom:16,padding:4}}>
            <div style={{padding:'12px 16px 0',fontSize:12,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.9px',color:'var(--text-muted)',display:'flex',alignItems:'center',gap:8}}><FileText size={13}/> Auto-fill from Resume</div>
            <div style={{padding:'8px 12px 12px'}}><ResumeUploadButton onParsed={handleResumeData}/></div>
          </div>
          {/* Step indicator */}
          <div style={{display:'flex',alignItems:'center',marginBottom:24}}>
            {STEPS.map((label,i)=>(<div key={i} style={{display:'flex',alignItems:'center',flex:i<STEPS.length-1?'1 1 auto':'none'}}>
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6}}>
                <div style={{width:32,height:32,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,background:i<step?'var(--success)':i===step?'var(--accent)':'var(--bg-tertiary)',color:i<=step?'white':'var(--text-muted)'}}>
                  {i<step?<CheckCircle size={14}/>:i+1}
                </div>
                <span style={{fontSize:11,fontWeight:600,color:i===step?'var(--accent)':i<step?'var(--success)':'var(--text-muted)',whiteSpace:'nowrap'}}>{label}</span>
              </div>
              {i<STEPS.length-1&&<div style={{flex:1,height:2,margin:'0 8px 18px',background:i<step?'var(--success)':'var(--border)',transition:'background 0.3s'}}/>}
            </div>))}
          </div>

          <div className="card">
            <h2 style={{fontFamily:'var(--font-display)',fontSize:20,marginBottom:4}}>{['Personal Information','Employment Details & Skills','Assign Roles','Review & Submit'][step]}</h2>
            <p style={{color:'var(--text-secondary)',fontSize:14,marginBottom:28}}>{['Fill in personal details, or upload a resume above to auto-fill','Departments, designations, dates and skills','Choose access roles for this employee','Review all details before creating the account'][step]}</p>

            {step===0&&<div>
              <BaseInput label="Full Name" icon={User} required placeholder="e.g. Mounish Kakarla" error={errors.name?.message} {...register('name',{required:'Full name is required',minLength:{value:2,message:'Too short'}})}/>
              <div className="grid-2">
                <BaseInput label="Company Email" icon={Mail} required type="email" placeholder="name@tektalis.com" error={errors.companyEmail?.message} {...register('companyEmail',{required:'Required',pattern:{value:/^[^\s@]+@[^\s@]+\.[^\s@]+$/,message:'Invalid email'}})}/>
                <BaseInput label="Personal Email" icon={Mail} required type="email" placeholder="personal@gmail.com" error={errors.personalEmail?.message} {...register('personalEmail',{required:'Required',pattern:{value:/^[^\s@]+@[^\s@]+\.[^\s@]+$/,message:'Invalid email'}})}/>
              </div>
              <div className="grid-2">
                <BaseInput label="Phone Number" icon={Phone} required placeholder="+91 9876543210" error={errors.phoneNumber?.message} {...register('phoneNumber',{required:'Required',pattern:{value:/^[0-9+\- ]{8,15}$/,message:'Invalid phone'}})}/>
                <BaseSelect label="Gender" required options={['MALE','FEMALE','OTHER']} error={errors.gender?.message} {...register('gender',{required:'Gender is required'})}/>
              </div>
              <BaseInput label="Address" icon={MapPin} required placeholder="Full address" error={errors.address?.message} {...register('address',{required:'Address is required'})}/>
            </div>}

            {step===1&&<div>
              <FormField label="Departments" icon={Building2} required error={departments.length===0?'At least one required':null}>
                <TagInput values={departments} onChange={setDepartments} suggestions={DEPARTMENTS} placeholder="Search departments…" chipColor="info" allowCustom={false}/>
              </FormField>
              <FormField label="Designations" icon={Briefcase} required error={designations.length===0?'At least one required':null}>
                <TagInput values={designations} onChange={setDesignations} suggestions={[]} placeholder="e.g. Senior Developer, Tech Lead" chipColor="accent" allowCustom/>
              </FormField>
              <div className="grid-2">
                <BaseInput label="Date of Joining" icon={Calendar} required type="date" error={errors.dateOfJoin?.message} {...register('dateOfJoin',{required:'Required'})}/>
                <BaseInput label="Date of Birth" icon={Calendar} required type="date" error={errors.dateOfBirth?.message} {...register('dateOfBirth',{required:'Required'})}/>
              </div>
              <FormField label="Skills" icon={Star}>
                <TagInput values={skills} onChange={setSkills} suggestions={SKILL_SUGGESTIONS} placeholder="Search or type a skill & press Enter…" chipColor="success" allowCustom/>
              </FormField>
              <BaseTextarea label="Description (optional)" placeholder="Brief description or notes…" {...register('description')}/>
            </div>}

            {step===2&&<div>
              <p style={{fontSize:14,color:'var(--text-secondary)',marginBottom:20}}>Select one or more access roles for this employee.</p>
              <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:8}}>
                {ROLES.map(role=><button key={role} type="button" onClick={()=>toggleRole(role)} style={{padding:'12px 28px',borderRadius:8,border:`2px solid ${roles.includes(role)?'var(--accent)':'var(--border)'}`,background:roles.includes(role)?'var(--accent-light)':'var(--bg-tertiary)',color:roles.includes(role)?'var(--accent)':'var(--text-secondary)',fontWeight:600,fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',gap:8,fontFamily:'var(--font-body)'}}>{roles.includes(role)&&<CheckCircle size={14}/>}{role}</button>)}
              </div>
              {roles.length===0&&<div className="form-error"><AlertCircle size={12}/> At least one role is required</div>}
            </div>}

            {step===3&&<div style={{display:'flex',flexDirection:'column',gap:16}}>
              {[['Personal Information',[['Full Name',values.name],['Gender',values.gender],['Company Email',values.companyEmail],['Personal Email',values.personalEmail],['Phone',values.phoneNumber],['Address',values.address]]],
                ['Employment Details',[['Departments',''],['Designations',''],['Date of Join',formatDate(values.dateOfJoin)],['Date of Birth',formatDate(values.dateOfBirth)]]]].map(([title,rows])=>(
                <div key={title} style={{background:'var(--bg-tertiary)',borderRadius:10,padding:'16px 20px'}}>
                  <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.9px',color:'var(--text-muted)',marginBottom:14}}>{title}</div>
                  <div className="grid-2">
                    {title==='Employment Details'?<>
                      <div><div style={{fontSize:11,color:'var(--text-muted)',marginBottom:2}}>Departments</div><div style={{display:'flex',gap:4,flexWrap:'wrap'}}>{departments.map(d=><span key={d} className="badge badge-info" style={{fontSize:11}}>{d}</span>)}</div></div>
                      <div><div style={{fontSize:11,color:'var(--text-muted)',marginBottom:2}}>Designations</div><div style={{display:'flex',gap:4,flexWrap:'wrap'}}>{designations.map(d=><span key={d} className="badge badge-accent" style={{fontSize:11}}>{d}</span>)}</div></div>
                      <div><div style={{fontSize:11,color:'var(--text-muted)',marginBottom:2}}>Date of Join</div><div style={{fontSize:14,fontWeight:500}}>{formatDate(values.dateOfJoin)}</div></div>
                      <div><div style={{fontSize:11,color:'var(--text-muted)',marginBottom:2}}>Date of Birth</div><div style={{fontSize:14,fontWeight:500}}>{formatDate(values.dateOfBirth)}</div></div>
                    </>:rows.map(([label,val])=><div key={label}><div style={{fontSize:11,color:'var(--text-muted)',marginBottom:2}}>{label}</div><div style={{fontSize:14,fontWeight:500}}>{val||'—'}</div></div>)}
                  </div>
                </div>
              ))}
              <div style={{padding:'12px 16px',background:'var(--info-light)',borderRadius:8,fontSize:13,color:'var(--info)'}}>ℹ️ Login credentials will be emailed to <strong>{values.personalEmail}</strong></div>
            </div>}

            <div style={{display:'flex',justifyContent:'space-between',marginTop:32,paddingTop:20,borderTop:'1px solid var(--border)'}}>
              <div>{step>0&&<button type="button" className="btn btn-secondary" onClick={()=>setStep(s=>s-1)} disabled={isSubmitting}><ArrowLeft size={14}/> Back</button>}</div>
              <div>{step<STEPS.length-1?<button type="button" className="btn btn-primary" onClick={nextStep}>Continue →</button>:<button type="button" className="btn btn-primary" onClick={handleCreate} disabled={isSubmitting} style={{minWidth:160,justifyContent:'center'}}>{isSubmitting?<><span className="spinner" style={{width:14,height:14}}/> Creating…</>:'Create Employee'}</button>}</div>
            </div>
          </div>
        </div>
      </motion.div>
    </FocusTrap>
  )
}
