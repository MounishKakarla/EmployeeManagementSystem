import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import FocusTrap from 'focus-trap-react'
import { Search, LayoutDashboard, Users, UserPlus, Settings, User, Command } from 'lucide-react'
import { employeeAPI } from '../../api'
import { useAuth } from '../../context/AuthContext'
export default function CommandPalette({ open, onClose }) {
  const [query,setQuery]=useState(''); const [selectedIndex,setSelectedIndex]=useState(0)
  const inputRef=useRef(null); const navigate=useNavigate(); const [_,setSearchParams]=useSearchParams(); const {isAdmin,isManager}=useAuth()
  useEffect(()=>{if(open){setQuery('');setSelectedIndex(0);setTimeout(()=>inputRef.current?.focus(),100)}},[open])
  const STATIC_ACTIONS=[
    {id:'dashboard',icon:LayoutDashboard,label:'Go to Dashboard',onSelect:()=>navigate('/dashboard')},
    {id:'profile',icon:User,label:'View My Profile',onSelect:()=>navigate('/profile')},
    {id:'settings',icon:Settings,label:'Settings & Preferences',onSelect:()=>navigate('/settings')},
  ]
  if(isAdmin()||isManager())STATIC_ACTIONS.push({id:'employees',icon:Users,label:'Browse Employees',onSelect:()=>navigate('/employees')})
  if(isAdmin())STATIC_ACTIONS.push({id:'add-emp',icon:UserPlus,label:'Add New Employee',onSelect:()=>navigate('/employees')})
  const{data,isFetching}=useQuery({queryKey:['cmd-search',query],queryFn:()=>employeeAPI.search({name:query,page:0,size:5}),enabled:open&&query.trim().length>1&&(isAdmin()||isManager())})
  const employeeResults=data?.data?.content||[]
  const filteredActions=STATIC_ACTIONS.filter(a=>a.label.toLowerCase().includes(query.toLowerCase()))
  const items=[];if(employeeResults.length>0){items.push({type:'header',label:'Employees'});employeeResults.forEach(emp=>items.push({type:'item',id:`emp-${emp.empId}`,icon:User,label:emp.name,subtitle:`${emp.empId} • ${emp.department}`,onSelect:()=>{setSearchParams(p=>{const n=new URLSearchParams(p);n.set('empId',emp.empId);return n})}}))}
  if(filteredActions.length>0){items.push({type:'header',label:'Quick Actions'});filteredActions.forEach(a=>items.push({type:'item',...a}))}
  const selectableItems=items.filter(i=>i.type==='item')
  useEffect(()=>{setSelectedIndex(0)},[query])
  const handleKeyDown=e=>{if(e.key==='ArrowDown'){e.preventDefault();setSelectedIndex(i=>(i+1)%selectableItems.length)}else if(e.key==='ArrowUp'){e.preventDefault();setSelectedIndex(i=>(i-1+selectableItems.length)%selectableItems.length)}else if(e.key==='Enter'){e.preventDefault();const item=selectableItems[selectedIndex];if(item){item.onSelect();onClose()}}else if(e.key==='Escape'){e.preventDefault();onClose()}}
  return (
    <AnimatePresence>{open&&(
      <FocusTrap focusTrapOptions={{initialFocus:false,escapeDeactivates:false,clickOutsideDeactivates:true}}>
        <div style={{position:'fixed',inset:0,zIndex:9999,display:'flex',justifyContent:'center',alignItems:'flex-start',paddingTop:'10vh'}}>
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.15}} style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.5)',backdropFilter:'blur(4px)'}} onClick={onClose}/>
          <motion.div role="dialog" aria-modal="true" aria-label="Command Palette" initial={{opacity:0,y:-20,scale:0.98}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:-20,scale:0.98}} transition={{duration:0.2,ease:'easeOut'}} style={{position:'relative',width:'100%',maxWidth:640,background:'var(--bg-card)',borderRadius:16,border:'1px solid var(--border)',boxShadow:'0 24px 48px rgba(0,0,0,0.2)',overflow:'hidden'}}>
            <div style={{display:'flex',alignItems:'center',padding:'16px 20px',borderBottom:'1px solid var(--border)'}}>
              <Search size={22} style={{color:'var(--text-muted)'}}/>
              <input ref={inputRef} value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={handleKeyDown} placeholder="Search employees or jump to..." style={{flex:1,border:'none',background:'transparent',outline:'none',fontSize:18,color:'var(--text-primary)',padding:'0 16px'}}/>
              {isFetching&&<div className="spinner" style={{width:18,height:18,marginRight:10}}/>}
              <div style={{display:'flex',alignItems:'center',gap:4,opacity:0.5}}><kbd style={{fontFamily:'var(--font-mono)',background:'var(--bg-tertiary)',padding:'4px 6px',borderRadius:4,fontSize:11,border:'1px solid var(--border)'}}>ESC</kbd></div>
            </div>
            <div style={{maxHeight:380,overflowY:'auto',padding:'8px 0',scrollbarWidth:'none'}}>
              {selectableItems.length===0 ? (
                <div style={{padding:'40px 20px',textAlign:'center',color:'var(--text-muted)'}}>No results for "{query}"</div>
              ) : (
                items.map((item, idx) => {
                  if (item.type === 'header') {
                    return (
                      <div key={`h${idx}`} style={{padding:'8px 20px',fontSize:12,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.5px'}}>{item.label}</div>
                    )
                  }

                  const si = selectableItems.indexOf(item)
                  const isSel = si === selectedIndex

                  return (
                    <div key={item.id} onMouseEnter={() => setSelectedIndex(si)} onClick={() => { item.onSelect(); onClose() }} style={{display:'flex',alignItems:'center',padding:'12px 20px',cursor:'pointer',background:isSel?'var(--bg-hover)':'transparent',borderLeft:`3px solid ${isSel?'var(--accent)':'transparent'}`,transition:'background 0.1s, border-color 0.1s'}}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'center',width:32,height:32,borderRadius:8,background:isSel?'var(--accent)':'var(--bg-tertiary)',color:isSel?'#fff':'var(--text-muted)',marginRight:16}}><item.icon size={16}/></div>
                      <div>
                        <div style={{fontSize:14,fontWeight:500,color:isSel?'var(--text-primary)':'var(--text-secondary)'}}>{item.label}</div>
                        {item.subtitle && <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>{item.subtitle}</div>}
                      </div>
                      {isSel && <div style={{marginLeft:'auto',opacity:0.5,display:'flex',alignItems:'center',gap:4}}><span style={{fontSize:11}}>Enter ↵</span></div>}
                    </div>
                  )
                })
              )}
            </div>
            <div style={{padding:'12px 20px',borderTop:'1px solid var(--border)',background:'var(--bg-tertiary)',fontSize:12,color:'var(--text-muted)',display:'flex',gap:16}}>
              <span><Command size={12} style={{display:'inline',verticalAlign:'-2px'}}/> +K to open</span><span>↕ to navigate</span><span>↵ to select</span>
            </div>
          </motion.div>
        </div>
      </FocusTrap>
    )}</AnimatePresence>
  )
}
