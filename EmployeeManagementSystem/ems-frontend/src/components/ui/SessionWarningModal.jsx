import { motion, AnimatePresence } from 'framer-motion'
import { Clock, LogOut, RefreshCw } from 'lucide-react'
export default function SessionWarningModal({ isOpen, onStay, onLogout }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div style={{ position:'fixed', inset:0, zIndex:10000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)' }} onClick={onStay}/>
          <motion.div initial={{ scale:0.9, opacity:0, y:20 }} animate={{ scale:1, opacity:1, y:0 }} exit={{ scale:0.9, opacity:0, y:20 }} className="glass-panel"
            style={{ position:'relative', width:'100%', maxWidth:400, backgroundColor:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:20, padding:32, textAlign:'center', boxShadow:'0 24px 64px rgba(0,0,0,0.4)' }}>
            <div style={{ width:64, height:64, borderRadius:'50%', background:'var(--warning-light)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px', color:'var(--warning)' }}><Clock size={32}/></div>
            <h2 style={{ fontSize:22, fontWeight:700, marginBottom:8 }}>Inactivity Warning</h2>
            <p style={{ color:'var(--text-secondary)', marginBottom:24, fontSize:15, lineHeight:1.6 }}>Your session will expire in <strong>60 seconds</strong>. Would you like to stay signed in?</p>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <button className="btn btn-primary" onClick={onStay} style={{ width:'100%', padding:'12px', fontSize:15 }}><RefreshCw size={18}/> Keep Me Signed In</button>
              <button className="btn btn-ghost" onClick={onLogout} style={{ width:'100%', padding:'12px', fontSize:15, color:'var(--text-muted)' }}><LogOut size={18}/> Sign Out Now</button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
