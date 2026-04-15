import { useEffect } from 'react'
import { X } from 'lucide-react'
const MAX_WIDTHS = { sm:'400px', md:'540px', lg:'720px', xl:'900px' }
export default function Modal({ open, onClose, title, children, footer, size='md' }) {
  useEffect(() => { document.body.style.overflow = open ? 'hidden' : ''; return () => { document.body.style.overflow = '' } }, [open])
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ maxWidth: MAX_WIDTHS[size] }}>
        <div className="modal-header"><h3 style={{ fontFamily:'var(--font-display)', fontSize:18 }}>{title}</h3><button className="btn-icon" onClick={onClose} aria-label="Close"><X size={16}/></button></div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}
