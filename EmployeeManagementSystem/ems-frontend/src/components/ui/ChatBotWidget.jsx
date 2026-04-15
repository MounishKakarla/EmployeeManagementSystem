import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, Bot, User, Loader2, RefreshCw, BarChart3, Table2, MessageSquare, Sparkles, Download, FileText, FileJson, History, Trash2, ExternalLink } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'
import FocusTrap from 'focus-trap-react'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const CHATBOT_URL  = import.meta.env.VITE_CHATBOT_API_URL || 'http://localhost:8000/api/chatbot'
const COLORS       = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#f97316']
const STORAGE_KEY  = 'aura_chat_history'
const SESSIONS_KEY = 'aura_chat_sessions'
const MAX_SESSIONS = 20

const INITIAL_MESSAGE = {
  role:      'assistant',
  content:   "Hi! I'm Aura, your EMS AI assistant. Ask me anything about your employee data — I can run queries, show charts, and surface insights.",
  timestamp: new Date().toISOString(),
}

const STARTER_PROMPTS = [
  'How many employees do we have?',
  'Show me department distribution',
  'Who joined this month?',
  'List employees in DEVELOPMENT',
  'Show attendance for today',
  'Which employees have pending leaves?',
]

// ── Storage helpers ────────────────────────────────────────────────────────────

function loadMessages() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch { /* corrupted — ignore */ }
  return [INITIAL_MESSAGE]
}

function saveMessages(messages) {
  try {
    const slim = messages.map(m => ({
      role:       m.role,
      content:    m.content,
      chart_type: m.chart_type  ?? null,
      table_data: m.table_data?.slice(0, 50) ?? null,
      chart_data: m.chart_data?.slice(0, 50) ?? null,
      timestamp:  m.timestamp   ?? new Date().toISOString(),
      action:     m.action      ?? null,
      entity:     m.entity      ?? null,
      label:      m.label       ?? null,
    }))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slim))
  } catch { /* storage full */ }
}

function loadSessions() {
  try {
    const saved = localStorage.getItem(SESSIONS_KEY)
    return saved ? JSON.parse(saved) : []
  } catch { return [] }
}

function saveSessions(sessions) {
  try { localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions)) }
  catch { /* fail silently */ }
}

function archiveCurrentSession(messages) {
  if (messages.length <= 1) return
  const sessions = loadSessions()
  const session  = {
    id:       Date.now(),
    date:     new Date().toLocaleString(),
    preview:  messages.find(m => m.role === 'user')?.content?.slice(0, 60) || 'Empty session',
    messages: messages.map(m => ({
      role:       m.role,
      content:    m.content,
      timestamp:  m.timestamp ?? new Date().toISOString(),
      table_data: m.table_data?.slice(0, 50) ?? null,
      chart_data: m.chart_data?.slice(0, 50) ?? null,
      chart_type: m.chart_type ?? null,
      action:     m.action     ?? null,
      entity:     m.entity     ?? null,
      label:      m.label      ?? null,
    })),
  }
  saveSessions([session, ...sessions].slice(0, MAX_SESSIONS))
}

// ── Export helpers ─────────────────────────────────────────────────────────────

function exportAsJSON(messages, filename = 'aura-chat-export.json') {
  const blob = new Blob([JSON.stringify({
    exported_at:    new Date().toISOString(),
    total_messages: messages.length,
    messages: messages.map(m => ({
      role:      m.role,
      content:   m.content,
      timestamp: m.timestamp ?? null,
      rows:      m.table_data ?? null,
    }))
  }, null, 2)], { type:'application/json' })
  triggerDownload(blob, filename)
}

function exportAsCSV(messages, filename = 'aura-chat-export.csv') {
  const lines = ['Timestamp,Role,Message,Rows']
  messages.forEach(m => {
    const ts      = m.timestamp ? new Date(m.timestamp).toLocaleString() : ''
    const content = `"${(m.content || '').replace(/"/g, '""')}"`
    const rows    = m.table_data ? m.table_data.length : ''
    lines.push(`${ts},${m.role},${content},${rows}`)
  })
  triggerDownload(new Blob([lines.join('\n')], { type:'text/csv' }), filename)
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a   = Object.assign(document.createElement('a'), { href:url, download:filename })
  a.click()
  URL.revokeObjectURL(url)
}

// ── Chart Renderer ─────────────────────────────────────────────────────────────

function ChartRenderer({ data, chartType }) {
  if (!data || !data.length) return null
  const keys    = Object.keys(data[0]).filter(k => k !== 'name' && k !== 'label')
  const nameKey = data[0].name !== undefined ? 'name' : Object.keys(data[0])[0]

  if (chartType === 'pie') return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" outerRadius={80} innerRadius={40}
          dataKey={keys[0]} nameKey={nameKey} paddingAngle={4}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip contentStyle={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:8, fontSize:12 }} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )

  if (chartType === 'line') return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey={nameKey} tick={{ fontSize:11, fill:'var(--text-muted)' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize:11, fill:'var(--text-muted)' }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:8, fontSize:12 }} />
        {keys.map((k, i) => <Line key={k} type="monotone" dataKey={k} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />)}
      </LineChart>
    </ResponsiveContainer>
  )

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey={nameKey} tick={{ fontSize:11, fill:'var(--text-muted)' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize:11, fill:'var(--text-muted)' }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:8, fontSize:12 }} />
        {keys.map((k, i) => <Bar key={k} dataKey={k} fill={COLORS[i % COLORS.length]} radius={[4,4,0,0]} />)}
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Table Renderer ─────────────────────────────────────────────────────────────

function TableRenderer({ rows }) {
  if (!rows || !rows.length) return null
  const cols = Object.keys(rows[0])
  return (
    <div style={{ overflowX:'auto', borderRadius:8, border:'1px solid var(--border)' }}>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
        <thead>
          <tr style={{ background:'var(--bg-tertiary)' }}>
            {cols.map(c => (
              <th key={c} style={{ padding:'8px 12px', textAlign:'left', fontWeight:600, color:'var(--text-secondary)', textTransform:'uppercase', fontSize:11, letterSpacing:'0.5px', whiteSpace:'nowrap' }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 20).map((row, i) => (
            <tr key={i} style={{ borderTop:'1px solid var(--border)', background:i%2===0?'transparent':'var(--bg-primary)' }}>
              {cols.map(c => (
                <td key={c} style={{ padding:'7px 12px', color:'var(--text-secondary)', whiteSpace:'nowrap', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis' }}>
                  {String(row[c] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
          {rows.length > 20 && (
            <tr>
              <td colSpan={cols.length} style={{ padding:'8px 12px', textAlign:'center', color:'var(--text-muted)', fontSize:11 }}>
                …and {rows.length - 20} more rows
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ── Message ────────────────────────────────────────────────────────────────────

function Message({ msg, onAction }) {
  const isUser = msg.role === 'user'
  return (
    <div style={{ display:'flex', gap:10, alignItems:'flex-start', flexDirection:isUser?'row-reverse':'row' }}>
      <div style={{ width:30, height:30, flexShrink:0, borderRadius:'50%', background:isUser?'var(--accent)':'var(--bg-tertiary)', display:'flex', alignItems:'center', justifyContent:'center', marginTop:2 }}>
        {isUser ? <User size={14} color="white" /> : <Bot size={14} color="var(--accent)" />}
      </div>
      <div style={{ maxWidth:'85%', display:'flex', flexDirection:'column', gap:8, alignItems:isUser?'flex-end':'flex-start' }}>

        {/* Bubble */}
        <div style={{ background:isUser?'var(--accent)':'var(--bg-tertiary)', color:isUser?'white':'var(--text-primary)', padding:'10px 14px', borderRadius:isUser?'16px 4px 16px 16px':'4px 16px 16px 16px', fontSize:13, lineHeight:1.6, wordBreak:'break-word' }}>
          {msg.content}
        </div>

        {/* Timestamp */}
        {msg.timestamp && (
          <div style={{ fontSize:10, color:'var(--text-muted)', paddingInline:4 }}>
            {new Date(msg.timestamp).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}
          </div>
        )}

        {/* CRUD action button */}
        {msg.action && msg.entity && onAction && (
          <button
            onClick={() => onAction({ action: msg.action, entity: msg.entity })}
            style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, padding:'7px 14px', borderRadius:8, background:'var(--accent)', color:'white', border:'none', cursor:'pointer', fontWeight:600, transition:'opacity 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.opacity='0.85'}
            onMouseLeave={e => e.currentTarget.style.opacity='1'}>
            <ExternalLink size={12} />
            Open {msg.label || `${msg.action} ${msg.entity}`} form
          </button>
        )}

        {/* Chart */}
        {msg.chart_data && msg.chart_data.length > 0 && (
          <div style={{ width:'100%', background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:12, padding:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:12, fontSize:12, color:'var(--text-muted)', fontWeight:600 }}>
              <BarChart3 size={13} /> Chart Visualisation
            </div>
            <ChartRenderer data={msg.chart_data} chartType={msg.chart_type || 'bar'} />
          </div>
        )}

        {/* Table */}
        {msg.table_data && msg.table_data.length > 0 && !msg.chart_data?.length && (
          <div style={{ width:'100%' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8, fontSize:12, color:'var(--text-muted)', fontWeight:600 }}>
              <Table2 size={13} /> Results ({msg.table_data.length} rows)
            </div>
            <TableRenderer rows={msg.table_data} />
          </div>
        )}

      </div>
    </div>
  )
}

// ── History Panel ──────────────────────────────────────────────────────────────

function HistoryPanel({ onLoad, onClose }) {
  const [sessions, setSessions] = useState(() => loadSessions())

  const deleteSession = (id) => {
    const updated = sessions.filter(s => s.id !== id)
    setSessions(updated)
    saveSessions(updated)
  }

  const deleteAll = () => {
    setSessions([])
    saveSessions([])
  }

  return (
    <motion.div
      initial={{ x:'100%' }} animate={{ x:0 }} exit={{ x:'100%' }}
      transition={{ type:'spring', damping:25, stiffness:200 }}
      style={{ position:'absolute', inset:0, background:'var(--bg-card)', zIndex:10, display:'flex', flexDirection:'column' }}>

      <div style={{ flexShrink:0, padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, fontWeight:700, fontSize:15 }}>
          <History size={16} color="var(--accent)" /> Chat History
        </div>
        <div style={{ display:'flex', gap:6 }}>
          {sessions.length > 0 && (
            <button className="btn-icon" onClick={deleteAll} title="Delete all">
              <Trash2 size={14} color="#ef4444" />
            </button>
          )}
          <button className="btn-icon" onClick={onClose} title="Close">
            <X size={16} />
          </button>
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:12, display:'flex', flexDirection:'column', gap:8 }}>
        {sessions.length === 0 ? (
          <div style={{ textAlign:'center', color:'var(--text-muted)', fontSize:13, marginTop:40 }}>
            No saved sessions yet.
          </div>
        ) : sessions.map(s => (
          <div key={s.id}
            style={{ background:'var(--bg-primary)', border:'1px solid var(--border)', borderRadius:10, padding:'10px 14px', transition:'border-color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor='var(--accent)'}
            onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
              <div onClick={() => onLoad(s.messages)} style={{ flex:1, cursor:'pointer' }}>
                <div style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', marginBottom:3, lineHeight:1.4 }}>
                  {s.preview}
                </div>
                <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                  {s.date} · {s.messages.length} messages
                </div>
              </div>
              <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                <button onClick={() => exportAsJSON(s.messages, `aura-session-${s.id}.json`)} title="Export JSON"
                  style={{ background:'none', border:'none', cursor:'pointer', padding:4, color:'var(--text-muted)', borderRadius:4 }}>
                  <FileJson size={13} />
                </button>
                <button onClick={() => exportAsCSV(s.messages, `aura-session-${s.id}.csv`)} title="Export CSV"
                  style={{ background:'none', border:'none', cursor:'pointer', padding:4, color:'var(--text-muted)', borderRadius:4 }}>
                  <FileText size={13} />
                </button>
                <button onClick={() => deleteSession(s.id)} title="Delete"
                  style={{ background:'none', border:'none', cursor:'pointer', padding:4, color:'var(--text-muted)', borderRadius:4 }}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

// ── Export Menu ────────────────────────────────────────────────────────────────

function ExportMenu({ messages, onClose }) {
  return (
    <motion.div
      initial={{ opacity:0, scale:0.95, y:-8 }}
      animate={{ opacity:1, scale:1,    y:0   }}
      exit={{    opacity:0, scale:0.95, y:-8  }}
      transition={{ duration:0.15 }}
      style={{ position:'absolute', top:56, right:16, zIndex:50, background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:10, boxShadow:'0 8px 24px rgba(0,0,0,0.15)', padding:6, minWidth:180 }}>
      {[
        { label:'Export as JSON', icon:<FileJson size={14} color="var(--accent)"/>, fn:() => exportAsJSON(messages) },
        { label:'Export as CSV',  icon:<FileText size={14} color="var(--accent)"/>, fn:() => exportAsCSV(messages)  },
      ].map(({ label, icon, fn }) => (
        <button key={label} onClick={() => { fn(); onClose() }}
          style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:'none', border:'none', cursor:'pointer', borderRadius:6, fontSize:13, color:'var(--text-primary)', textAlign:'left' }}
          onMouseEnter={e => e.currentTarget.style.background='var(--bg-tertiary)'}
          onMouseLeave={e => e.currentTarget.style.background='none'}>
          {icon} {label}
        </button>
      ))}
    </motion.div>
  )
}

// ── Main Widget ────────────────────────────────────────────────────────────────

export default function ChatBotWidget({ onClose, onAction }) {
  const { chatWidth, setChatWidth } = useUIStore()

  const [messages,    setMessages]    = useState(() => loadMessages())
  const [input,       setInput]       = useState('')
  const [loading,     setLoading]     = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showExport,  setShowExport]  = useState(false)
  const [sessionId]                   = useState(() => `session-${Date.now()}`)

  const bottomRef  = useRef(null)
  const inputRef   = useRef(null)
  const isResizing = useRef(false)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }) }, [messages])
  useEffect(() => { saveMessages(messages) }, [messages])

  useEffect(() => {
    if (!showExport) return
    const handler = () => setShowExport(false)
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showExport])

  const startResize = () => {
    isResizing.current = true
    document.addEventListener('mousemove', handleResize)
    document.addEventListener('mouseup', endResize)
  }
  const handleResize = e => {
    if (!isResizing.current) return
    const nW = window.innerWidth - e.clientX
    if (nW >= 320 && nW <= 700) setChatWidth(nW)
  }
  const endResize = () => {
    isResizing.current = false
    document.removeEventListener('mousemove', handleResize)
    document.removeEventListener('mouseup', endResize)
  }

  const handleAction = useCallback(({ action, entity }) => {
    if (onAction) onAction({ action, entity })
  }, [onAction])

  const sendMessage = useCallback(async (text) => {
    const q = (text || input).trim()
    if (!q || loading) return
    setInput('')
    setMessages(prev => [...prev, { role:'user', content:q, timestamp:new Date().toISOString() }])
    setLoading(true)
    try {
      const res = await fetch(`${CHATBOT_URL}/query`, {
        method:  'POST',
        headers: { 'Content-Type':'application/json' },
        credentials: 'include',
        body: JSON.stringify({ question:q, session_id:sessionId })
      })
      if (!res.ok) {
        let errDesc = '';
        try { const errJson = await res.json(); errDesc = errJson.detail || ''; } catch { }
        throw new Error(`API error ${res.status} - ${errDesc}`)
      }
      const data = await res.json()

      // ── CRUD action response ──────────────────────────────────────────────
      if (data.action) {
        setMessages(prev => [...prev, {
          role:      'assistant',
          content:   data.message || `Opening the ${data.label} form for you.`,
          timestamp: new Date().toISOString(),
          action:    data.action,
          entity:    data.entity,
          label:     data.label,
        }])
        if (onAction) onAction({ action: data.action, entity: data.entity })
        return
      }

      // ── Normal query response ─────────────────────────────────────────────
      const rowCount = data.row_count ?? 0
      const summary  = data.message
        || (rowCount > 0
            ? `Found ${rowCount} result${rowCount !== 1 ? 's' : ''}.`
            : 'Query ran successfully, no rows returned.')

      setMessages(prev => [...prev, {
        role:       'assistant',
        content:    summary,
        table_data: data.rows ?? [],
        chart_data: data.chart_type && data.rows?.length ? data.rows : null,
        chart_type: data.chart_type,
        timestamp:  new Date().toISOString(),
      }])
    } catch (err) {
      setMessages(prev => [...prev, {
        role:      'assistant',
        content:   `Sorry, I encountered an error: ${err.message}. Make sure the Python service is running on port 8000.`,
        timestamp: new Date().toISOString(),
      }])
    } finally {
      setLoading(false)
    }
  }, [input, loading, sessionId, onAction])

  const clearChat = () => {
    archiveCurrentSession(messages)
    localStorage.removeItem(STORAGE_KEY)
    setMessages([{ ...INITIAL_MESSAGE, timestamp: new Date().toISOString(), content: "Chat cleared! Ask me anything about your employee data." }])
  }

  const loadSession = (sessionMessages) => {
    archiveCurrentSession(messages)
    setMessages(sessionMessages)
    setShowHistory(false)
  }

  return (
    <FocusTrap focusTrapOptions={{ initialFocus:false, escapeDeactivates:false, clickOutsideDeactivates:true }}>
      <motion.div
        role="dialog" aria-modal="true" aria-label="Aura AI Chatbot"
        initial={{ x:'100%', opacity:0 }} animate={{ x:0, opacity:1 }} exit={{ x:'100%', opacity:0 }}
        transition={{ type:'spring', damping:25, stiffness:200 }}
        className="glass-panel"
        style={{ position:'fixed', top:'var(--topnav-height)', right:0, bottom:0, width:`${chatWidth}px`, maxWidth:'90vw', zIndex:1040, borderLeft:'1px solid var(--border)', display:'flex', flexDirection:'column', background:'var(--bg-card)', overflow:'hidden' }}>

        <div onMouseDown={startResize} style={{ position:'absolute', left:0, top:0, bottom:0, width:6, cursor:'ew-resize', zIndex:20 }} className="resize-handle" />

        {/* Header */}
        <div style={{ flexShrink:0, padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', background:'var(--bg-card)', position:'relative', zIndex:5 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:34, height:34, borderRadius:'50%', background:'linear-gradient(135deg, var(--accent), #9333ea)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Sparkles size={16} color="white" />
            </div>
            <div>
              <div style={{ fontWeight:700, fontSize:15 }}>Aura</div>
              <div style={{ fontSize:11, color:'var(--success)', display:'flex', alignItems:'center', gap:4 }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--success)', display:'inline-block' }} />
                AI Assistant
              </div>
            </div>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <div style={{ position:'relative' }}>
              <button className="btn-icon" title="Export chat" onClick={e => { e.stopPropagation(); setShowExport(v => !v) }}>
                <Download size={14} />
              </button>
              <AnimatePresence>
                {showExport && <ExportMenu messages={messages} onClose={() => setShowExport(false)} />}
              </AnimatePresence>
            </div>
            <button className="btn-icon" title="Chat history" onClick={() => setShowHistory(true)}><History size={14} /></button>
            <button className="btn-icon" title="Clear chat"   onClick={clearChat}><RefreshCw size={14} /></button>
            <button className="btn-icon" title="Close"        onClick={onClose}><X size={16} /></button>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex:1, overflowY:'auto', padding:'16px 16px 8px', display:'flex', flexDirection:'column', gap:16 }}>
          {messages.map((m, i) => <Message key={i} msg={m} onAction={handleAction} />)}
          {loading && (
            <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
              <div style={{ width:30, height:30, borderRadius:'50%', background:'var(--bg-tertiary)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <Bot size={14} color="var(--accent)" />
              </div>
              <div style={{ background:'var(--bg-tertiary)', padding:'12px 16px', borderRadius:'4px 16px 16px 16px', display:'flex', gap:6, alignItems:'center' }}>
                {[0,1,2].map(i => (
                  <span key={i} style={{ width:6, height:6, borderRadius:'50%', background:'var(--accent)', opacity:0.6, animation:`bounce 1s ${i*0.15}s infinite alternate` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Starter prompts */}
        {messages.length <= 1 && (
          <div style={{ padding:'8px 16px', display:'flex', flexWrap:'wrap', gap:6 }}>
            {STARTER_PROMPTS.map(p => (
              <button key={p} onClick={() => sendMessage(p)}
                style={{ fontSize:11, padding:'5px 10px', border:'1px solid var(--border)', borderRadius:100, background:'var(--bg-primary)', color:'var(--text-secondary)', cursor:'pointer', transition:'all 0.15s', whiteSpace:'nowrap' }}
                onMouseEnter={e => { e.target.style.borderColor='var(--accent)'; e.target.style.color='var(--accent)' }}
                onMouseLeave={e => { e.target.style.borderColor='var(--border)'; e.target.style.color='var(--text-secondary)' }}>
                {p}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div style={{ flexShrink:0, padding:'12px 16px', borderTop:'1px solid var(--border)', background:'var(--bg-card)' }}>
          <div style={{ display:'flex', gap:8, alignItems:'flex-end', background:'var(--bg-primary)', border:'1px solid var(--border)', borderRadius:12, padding:'8px 8px 8px 14px', transition:'border-color 0.2s', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
            <MessageSquare size={15} color="var(--text-muted)" style={{ flexShrink:0, marginTop:8 }} />
            <textarea
              ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
              placeholder="Ask about employees, attendance, leaves…"
              rows={1}
              style={{ flex:1, border:'none', outline:'none', resize:'none', background:'transparent', fontSize:13, color:'var(--text-primary)', lineHeight:1.5, fontFamily:'var(--font-body)', maxHeight:120, overflowY:'auto' }}
              onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
            />
            <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
              style={{ flexShrink:0, width:34, height:34, borderRadius:8, background:input.trim()&&!loading?'var(--accent)':'var(--bg-tertiary)', border:'none', cursor:input.trim()&&!loading?'pointer':'not-allowed', display:'flex', alignItems:'center', justifyContent:'center', transition:'background 0.15s' }}>
              {loading
                ? <Loader2 size={15} color="var(--text-muted)" style={{ animation:'spin 0.7s linear infinite' }} />
                : <Send size={15} color={input.trim()&&!loading?'white':'var(--text-muted)'} />}
            </button>
          </div>
          <p style={{ fontSize:10, color:'var(--text-muted)', textAlign:'center', marginTop:8 }}>
            Powered by Groq LLaMA · Results are AI-generated
          </p>
        </div>

        <AnimatePresence>
          {showHistory && <HistoryPanel onLoad={loadSession} onClose={() => setShowHistory(false)} />}
        </AnimatePresence>

        <style>{`
          @keyframes bounce { from { transform:translateY(0) } to { transform:translateY(-4px) } }
          @keyframes spin   { from { transform:rotate(0deg)  } to { transform:rotate(360deg)  } }
        `}</style>
      </motion.div>
    </FocusTrap>
  )
}