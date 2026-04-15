import { useRef, useState } from 'react'
import { FileText, Upload, Loader2, X, CheckCircle } from 'lucide-react'
import { parseResume } from '../../hooks/useResumeParser'
import toast from 'react-hot-toast'
export default function ResumeUploadButton({ onParsed }) {
  const inputRef=useRef(null); const [state,setState]=useState('idle'); const [fileName,setFileName]=useState('')
  const handleFile=async file=>{if(!file||file.type!=='application/pdf'){toast.error('Please upload a PDF file');return};setFileName(file.name);setState('loading');try{const data=await parseResume(file);if(data.error)throw new Error(data.details||data.error);setState('done');onParsed(data);toast.success('Resume parsed! Fields auto-filled below.')}catch{setState('error');toast.error('Could not parse resume. Please fill fields manually.')}}
  const handleDrop=e=>{e.preventDefault();handleFile(e.dataTransfer.files[0])}
  const reset=e=>{e.stopPropagation();setState('idle');setFileName('');if(inputRef.current)inputRef.current.value=''}
  const borderColor=state==='done'?'var(--success)':state==='error'?'var(--danger)':'var(--accent)'
  const bgColor=state==='done'?'var(--success-light)':state==='error'?'var(--danger-light)':'var(--accent-light)'
  const iconBg=state==='done'?'var(--success)':state==='error'?'var(--danger)':'var(--accent)'
  return (
    <div onClick={()=>state==='idle'&&inputRef.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={handleDrop} role={state==='idle'?'button':undefined} tabIndex={state==='idle'?0:undefined} style={{ border:`2px dashed ${borderColor}`,borderRadius:'var(--radius-lg)',padding:'20px 24px',background:bgColor,cursor:state==='loading'?'not-allowed':state==='idle'?'pointer':'default',display:'flex',alignItems:'center',gap:16,transition:'all 0.2s',userSelect:'none' }}>
      <input ref={inputRef} type="file" accept=".pdf" style={{ display:'none' }} onChange={e=>handleFile(e.target.files[0])}/>
      <div style={{ width:44,height:44,flexShrink:0,borderRadius:10,background:iconBg,display:'flex',alignItems:'center',justifyContent:'center' }}>
        {state==='loading'?<Loader2 size={20} color="white" style={{ animation:'spin 0.7s linear infinite' }}/>:state==='done'?<CheckCircle size={20} color="white"/>:<FileText size={20} color="white"/>}
      </div>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:14,fontWeight:600,color:iconBg,marginBottom:2 }}>
          {state==='idle'&&'📄 Auto-fill from Resume (PDF)'}{state==='loading'&&'Parsing resume…'}{state==='done'&&`Resume parsed: ${fileName}`}{state==='error'&&'Parsing failed — fill manually'}
        </div>
        <div style={{ fontSize:12,color:'var(--text-muted)' }}>
          {state==='idle'&&'Click or drag & drop a PDF — fields will be auto-filled'}{state==='loading'&&'Extracting name, email, phone, skills…'}{state==='done'&&'Review the pre-filled fields and adjust if needed'}{state==='error'&&'Only PDF files are supported'}
        </div>
      </div>
      {(state==='done'||state==='error')&&<button onClick={reset} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',padding:4,flexShrink:0 }} title="Upload a different file"><X size={16}/></button>}
      {state==='idle'&&<div style={{ display:'flex',alignItems:'center',gap:6,color:'var(--accent)',fontSize:13,fontWeight:500 }}><Upload size={14}/> Upload</div>}
    </div>
  )
}
