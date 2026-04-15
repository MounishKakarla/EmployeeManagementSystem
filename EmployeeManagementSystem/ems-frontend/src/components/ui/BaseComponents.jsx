import { forwardRef, useState } from 'react'
import { Eye, EyeOff, AlertCircle, ChevronDown } from 'lucide-react'

export const BaseInput = forwardRef(function BaseInput(
  { label, error, icon: Icon, type='text', hint, readOnly, required, className='', ...props }, ref
) {
  const [showPass, setShowPass] = useState(false)
  const isPassword = type === 'password'
  const inputType  = isPassword ? (showPass ? 'text' : 'password') : type

  return (
    <div className="form-group">
      {label && (
        <label className="form-label">
          {Icon && <Icon size={12} style={{ color:'var(--text-muted)', marginRight:4 }}/>}
          {label}
          {required && <span style={{ color:'var(--danger)', marginLeft:2 }}>*</span>}
        </label>
      )}
      <div style={{ position:'relative' }}>
        <input ref={ref} type={inputType}
          className={`form-input ${error?'input-error':''} ${readOnly?'input-readonly':''} ${className}`}
          style={{ borderColor:error?'var(--danger)':undefined, paddingRight:isPassword?44:undefined, background:readOnly?'var(--bg-tertiary)':undefined, cursor:readOnly?'not-allowed':undefined }}
          readOnly={readOnly} disabled={readOnly} {...props}/>
        {isPassword && (
          <button type="button" onClick={()=>setShowPass(v=>!v)}
            style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:4 }} tabIndex={-1}>
            {showPass ? <EyeOff size={16}/> : <Eye size={16}/>}
          </button>
        )}
      </div>
      {hint && !error && <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:4 }}>{hint}</p>}
      {error && <div className="form-error"><AlertCircle size={12}/> {error}</div>}
    </div>
  )
})

export const BaseTextarea = forwardRef(function BaseTextarea(
  { label, error, required, readOnly, rows=3, ...props }, ref
) {
  return (
    <div className="form-group">
      {label && (
        <label className="form-label">{label}{required && <span style={{ color:'var(--danger)', marginLeft:2 }}>*</span>}</label>
      )}
      <textarea ref={ref} className={`form-input ${error?'input-error':''}`} rows={rows}
        style={{ resize:'vertical', borderColor:error?'var(--danger)':undefined, background:readOnly?'var(--bg-tertiary)':undefined, cursor:readOnly?'not-allowed':undefined }}
        readOnly={readOnly} disabled={readOnly} {...props}/>
      {error && <div className="form-error"><AlertCircle size={12}/> {error}</div>}
    </div>
  )
})

export const BaseSelect = forwardRef(function BaseSelect(
  { label, error, required, options=[], placeholder='Select…', ...props }, ref
) {
  return (
    <div className="form-group">
      {label && (
        <label className="form-label">{label}{required && <span style={{ color:'var(--danger)', marginLeft:2 }}>*</span>}</label>
      )}
      <select ref={ref} className={`form-select ${error?'input-error':''}`} style={{ borderColor:error?'var(--danger)':undefined }} {...props}>
        <option value="">{placeholder}</option>
        {options.map(opt => typeof opt === 'string'
          ? <option key={opt} value={opt}>{opt}</option>
          : <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
      {error && <div className="form-error"><AlertCircle size={12}/> {error}</div>}
    </div>
  )
})

export function BaseButton({ children, variant='primary', size='md', loading=false, icon: Icon, fullWidth=false, ...props }) {
  const sizeClass = size==='sm'?'btn-sm':size==='lg'?'btn-lg':''
  return (
    <button className={`btn btn-${variant} ${sizeClass}`}
      style={{ width:fullWidth?'100%':undefined, justifyContent:fullWidth?'center':undefined }}
      disabled={loading||props.disabled} {...props}>
      {loading ? <span className="spinner" style={{ width:size==='sm'?12:14, height:size==='sm'?12:14 }}/> : Icon && <Icon size={size==='sm'?13:15}/>}
      {children}
    </button>
  )
}

export function FormField({ label, icon: Icon, error, required, children }) {
  return (
    <div className="form-group">
      {label && (
        <label className="form-label" style={{ display:'flex', alignItems:'center', gap:6 }}>
          {Icon && <Icon size={12} color="var(--text-muted)"/>}
          {label}
          {required && <span style={{ color:'var(--danger)' }}>*</span>}
        </label>
      )}
      {children}
      {error && <div className="form-error"><AlertCircle size={12}/> {error}</div>}
    </div>
  )
}
