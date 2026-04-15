// src/components/ui/ErrorBoundary.jsx
import React from 'react'
import { AlertCircle, RefreshCw, Home } from 'lucide-react'

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null } }
  static getDerivedStateFromError(error) { return { hasError: true, error } }
  componentDidCatch(error, info) { console.error('Uncaught error:', error, info) }
  render() {
    if (this.state.hasError) return (
      <div style={{ height:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'var(--bg-primary)', padding:24 }}>
        <div className="glass-panel" style={{ maxWidth:500, padding:'48px 32px', borderRadius:'var(--radius-xl)', border:'1px solid var(--border)', display:'flex', flexDirection:'column', alignItems:'center', gap:20 }}>
          <div style={{ width:80, height:80, borderRadius:'50%', background:'var(--danger-light)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <AlertCircle size={40} color="var(--danger)" />
          </div>
          <h1 style={{ fontSize:24, fontWeight:800, margin:0 }}>Something went wrong</h1>
          <p style={{ color:'var(--text-secondary)', lineHeight:1.6, margin:0 }}>An unexpected error occurred. Try reloading the application.</p>
          <div style={{ display:'flex', gap:12, width:'100%' }}>
            <button className="btn btn-primary" onClick={() => window.location.reload()} style={{ flex:1, justifyContent:'center' }}><RefreshCw size={16}/> Reload</button>
            <button className="btn btn-secondary" onClick={() => window.location.href='/'} style={{ flex:1, justifyContent:'center' }}><Home size={16}/> Home</button>
          </div>
        </div>
      </div>
    )
    return this.props.children
  }
}
export default ErrorBoundary
