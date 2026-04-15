import Modal from './Modal'
import { AlertTriangle } from 'lucide-react'
export default function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel='Confirm', danger=false, loading=false }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm" footer={<><button className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button><button className={`btn ${danger?'btn-danger':'btn-primary'}`} onClick={onConfirm} disabled={loading}>{loading&&<span className="spinner" style={{ width:14, height:14 }}/>}{confirmLabel}</button></>}>
      <div style={{ display:'flex', gap:16, alignItems:'flex-start' }}>
        {danger&&<div style={{ background:'var(--danger-light)', padding:10, borderRadius:8, flexShrink:0 }}><AlertTriangle size={20} color="var(--danger)"/></div>}
        <p style={{ color:'var(--text-secondary)', lineHeight:1.6 }}>{message}</p>
      </div>
    </Modal>
  )
}
