import { useState, useRef, useEffect } from 'react'
import { X, ChevronDown } from 'lucide-react'
const CHIP_COLORS = { accent:{bg:'var(--accent-light)',color:'var(--accent)'}, info:{bg:'var(--info-light)',color:'var(--info)'}, success:{bg:'var(--success-light)',color:'var(--success)'}, warning:{bg:'var(--warning-light)',color:'var(--warning)'} }
export default function TagInput({ values=[], onChange, suggestions=[], placeholder='Type to search or add…', disabled=false, allowCustom=true, chipColor='accent' }) {
  const [input,setInput]=useState(''); const [open,setOpen]=useState(false); const [highlightIdx,setHighlightIdx]=useState(-1)
  const inputRef=useRef(null); const containerRef=useRef(null)
  const chip=CHIP_COLORS[chipColor]??CHIP_COLORS.accent
  useEffect(()=>{ const h=e=>{if(containerRef.current&&!containerRef.current.contains(e.target)){setOpen(false);setHighlightIdx(-1)}}; document.addEventListener('mousedown',h); return ()=>document.removeEventListener('mousedown',h) },[])
  const filtered=suggestions.filter(s=>!values.some(v=>v.toLowerCase()===s.toLowerCase())).filter(s=>!input||s.toLowerCase().includes(input.toLowerCase())).slice(0,8)
  const addValue=val=>{const t=val.trim();if(!t)return;if(values.some(v=>v.toLowerCase()===t.toLowerCase())){setInput('');return};if(!allowCustom){const m=suggestions.find(s=>s.toLowerCase()===t.toLowerCase());if(!m)return;onChange([...values,m])}else{const m=suggestions.find(s=>s.toLowerCase()===t.toLowerCase());onChange([...values,m||t])};setInput('');setHighlightIdx(-1);inputRef.current?.focus()}
  const removeValue=val=>{onChange(values.filter(v=>v!==val));inputRef.current?.focus()}
  const handleKeyDown=e=>{switch(e.key){case'Enter':case',':e.preventDefault();if(highlightIdx>=0&&filtered[highlightIdx])addValue(filtered[highlightIdx]);else if(input.trim()&&allowCustom)addValue(input);break;case'Backspace':if(!input&&values.length>0)removeValue(values[values.length-1]);break;case'ArrowDown':e.preventDefault();setHighlightIdx(i=>Math.min(i+1,filtered.length-1));setOpen(true);break;case'ArrowUp':e.preventDefault();setHighlightIdx(i=>Math.max(i-1,-1));break;case'Escape':setOpen(false);setHighlightIdx(-1);break}}
  const showDropdown=open&&!disabled&&(filtered.length>0||(allowCustom&&input.trim()))
  return (
    <div ref={containerRef} style={{ position:'relative' }}>
      <div onClick={()=>{if(!disabled){inputRef.current?.focus();setOpen(true)}}} style={{ border:`1px solid ${open?'var(--accent)':'var(--border)'}`,borderRadius:'var(--radius-md)',padding:'6px 10px',background:disabled?'var(--bg-tertiary)':'var(--bg-primary)',display:'flex',flexWrap:'wrap',gap:6,alignItems:'center',minHeight:44,cursor:disabled?'not-allowed':'text',transition:'border-color 0.15s, box-shadow 0.15s',boxShadow:open?'0 0 0 3px rgba(212,83,10,0.10)':'none'}}>
        {values.map(v=><span key={v} style={{ display:'inline-flex',alignItems:'center',gap:4,background:chip.bg,color:chip.color,borderRadius:4,padding:'2px 8px',fontSize:12,fontWeight:600,userSelect:'none' }}>{v}{!disabled&&<button type="button" onMouseDown={e=>{e.preventDefault();removeValue(v)}} style={{ background:'none',border:'none',cursor:'pointer',padding:0,lineHeight:1,color:chip.color,opacity:0.7,display:'flex',alignItems:'center' }} aria-label={`Remove ${v}`}><X size={10}/></button>}</span>)}
        {!disabled&&<input ref={inputRef} value={input} onChange={e=>{setInput(e.target.value);setOpen(true);setHighlightIdx(-1)}} onKeyDown={handleKeyDown} onFocus={()=>setOpen(true)} placeholder={values.length===0?placeholder:'+ add more…'} style={{ border:'none',outline:'none',background:'transparent',fontSize:13,color:'var(--text-primary)',minWidth:80,flex:1,padding:'2px 0' }}/>}
        {!disabled&&suggestions.length>0&&<ChevronDown size={14} color="var(--text-muted)" style={{ flexShrink:0,cursor:'pointer',transition:'transform 0.15s',transform:open?'rotate(180deg)':'rotate(0deg)'}} onMouseDown={e=>{e.preventDefault();setOpen(o=>!o)}}/>}
      </div>
      {showDropdown&&<div style={{ position:'absolute',top:'calc(100% + 4px)',left:0,right:0,zIndex:200,background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:'var(--radius-md)',boxShadow:'var(--shadow-lg)',overflow:'hidden',maxHeight:260,overflowY:'auto' }}>
        {allowCustom&&input.trim()&&!filtered.some(f=>f.toUpperCase()===input.trim().toUpperCase())&&<div onMouseDown={e=>{e.preventDefault();addValue(input)}} style={{ padding:'9px 14px',fontSize:13,cursor:'pointer',color:'var(--accent)',fontWeight:600,borderBottom:filtered.length>0?'1px solid var(--border)':'none',display:'flex',alignItems:'center',gap:8,background:highlightIdx===-2?'var(--accent-light)':'transparent'}} onMouseEnter={()=>setHighlightIdx(-2)}><span style={{ fontSize:10,background:'var(--accent-light)',color:'var(--accent)',padding:'1px 6px',borderRadius:3,fontWeight:700,letterSpacing:'0.5px' }}>ADD</span>"{input.trim().toUpperCase()}"</div>}
        {filtered.map((s,i)=><div key={s} onMouseDown={e=>{e.preventDefault();addValue(s)}} onMouseEnter={()=>setHighlightIdx(i)} style={{ padding:'9px 14px',fontSize:13,cursor:'pointer',background:highlightIdx===i?'var(--bg-hover)':'transparent',color:'var(--text-primary)',display:'flex',alignItems:'center',gap:8,transition:'background 0.1s' }}>{s}</div>)}
        {filtered.length===0&&!(allowCustom&&input.trim())&&<div style={{ padding:'10px 14px',fontSize:13,color:'var(--text-muted)' }}>No options match</div>}
      </div>}
    </div>
  )
}
