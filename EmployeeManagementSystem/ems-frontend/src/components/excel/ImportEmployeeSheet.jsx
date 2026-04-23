// src/components/ui/ImportEmployeeSheet.jsx
import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { useMutation } from '@tanstack/react-query'
import FocusTrap from 'focus-trap-react'
import { importAPI } from '../../api'
import { parseApiError } from '../../utils/errorUtils'
import { useUIStore } from '../../store/uiStore'
import {
  X, Upload, FileSpreadsheet, CheckCircle,
  AlertCircle, Download, Loader2, RotateCcw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'

const TEMPLATE_HEADERS = [
  'Name','Company Email','Personal Email','Phone Number',
  'Address','Department','Designation','Skills',
  'Date of Joining','Date of Birth','Roles',
]

const EXAMPLE_ROW = [
  'John Doe','john.doe@tektalis.com','john@gmail.com','9876543210',
  'Hyderabad, TS','DEVELOPMENT','Software Engineer','JavaScript, React, Node.js',
  '2026-01-15','1995-06-20','EMPLOYEE',
]

function downloadTemplate() {
  const ws   = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, EXAMPLE_ROW])
  const wb   = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Employees')
  XLSX.writeFile(wb, 'employee_import_template.xlsx')
}

export default function ImportEmployeeSheet({ onClose, onSuccess }) {
  const { sideSheetWidth, setSideSheetWidth, isChatOpen, chatWidth } = useUIStore()
  const isResizing = useRef(false)
  const fileRef    = useRef(null)

  const [file,   setFile]   = useState(null)
  const [result, setResult] = useState(null)
  const [isDrag, setIsDrag] = useState(false)

  const startResize = () => {
    isResizing.current = true
    document.addEventListener('mousemove', handleResize)
    document.addEventListener('mouseup', endResize)
  }
  const handleResize = (e) => {
    if (!isResizing.current) return
    const rightEdge = isChatOpen ? chatWidth : 0
    const newWidth  = window.innerWidth - e.clientX - rightEdge
    if (newWidth >= 400 && newWidth <= window.innerWidth * 0.7) setSideSheetWidth(newWidth)
  }
  const endResize = () => {
    isResizing.current = false
    document.removeEventListener('mousemove', handleResize)
    document.removeEventListener('mouseup', endResize)
  }

  const mutation = useMutation({
    mutationFn: (f) => {
      const fd = new FormData()
      fd.append('file', f)
      return importAPI.importEmployees(fd)
    },
    onSuccess: (res) => {
      setResult(res.data)
      if (res.data.successCount > 0) {
        toast.success(`${res.data.successCount} employee${res.data.successCount !== 1 ? 's' : ''} imported!`)
        onSuccess?.()
      }
    },
    onError: (err) => toast.error(parseApiError(err, 'Import failed')),
  })

  const handleFile = (f) => {
    if (!f) return
    if (!f.name.endsWith('.xlsx') && !f.name.endsWith('.xls')) {
      toast.error('Only .xlsx and .xls files are accepted')
      return
    }
    setFile(f)
    setResult(null)
  }

  const handleDrop = (e) => {
    e.preventDefault(); setIsDrag(false)
    handleFile(e.dataTransfer.files[0])
  }

  const reset = () => {
    setFile(null); setResult(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <FocusTrap focusTrapOptions={{ initialFocus: false, escapeDeactivates: false, clickOutsideDeactivates: true }}>
      <motion.div role="dialog" aria-modal="true" aria-label="Import Employees from Excel"
        initial={{ x: '100%', opacity: 0 }} animate={{ x: 0, opacity: 1 }}
        exit={{ x: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="glass-panel"
        style={{
          position: 'fixed', top: 'var(--topnav-height)',
          right: isChatOpen ? chatWidth : 0, bottom: 0,
          width: `${sideSheetWidth}px`, maxWidth: '90vw',
          zIndex: 1050, borderLeft: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
          background: 'var(--bg-card)', transition: 'right 0.3s ease',
        }}
      >
        {/* Resize handle */}
        <div onMouseDown={startResize} style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: 6, cursor: 'ew-resize', zIndex: 20,
        }} className="resize-handle" />

        {/* Header */}
        <div style={{
          flexShrink: 0, padding: '16px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'var(--bg-card)',
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%',
              background: 'var(--success)', boxShadow: '0 0 8px var(--success)' }} />
            Import Employees from Excel
          </h2>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

          {/* Template download */}
          <div style={{ marginBottom: 24, padding: '14px 18px',
            background: 'var(--info-light)', borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--info)', marginBottom: 2 }}>
                Download Template
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Use this template to ensure correct column formatting
              </div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={downloadTemplate}>
              <Download size={13} /> Template
            </button>
          </div>

          {/* Drop zone */}
          {!result && (
            <div
              onDragOver={e => { e.preventDefault(); setIsDrag(true) }}
              onDragLeave={() => setIsDrag(false)}
              onDrop={handleDrop}
              onClick={() => !file && fileRef.current?.click()}
              style={{
                border: `2px dashed ${isDrag ? 'var(--accent)' : file ? 'var(--success)' : 'var(--border)'}`,
                borderRadius: 12, padding: '40px 24px', textAlign: 'center',
                cursor: file ? 'default' : 'pointer',
                background: isDrag ? 'var(--accent-light)' : file ? 'var(--success-light)' : 'var(--bg-primary)',
                transition: 'all 0.2s', marginBottom: 20,
              }}
            >
              <input ref={fileRef} type="file" accept=".xlsx,.xls"
                style={{ display: 'none' }}
                onChange={e => handleFile(e.target.files[0])} />

              {mutation.isPending ? (
                <>
                  <Loader2 size={40} style={{ color: 'var(--accent)', margin: '0 auto 12px',
                    animation: 'spin 0.7s linear infinite', display: 'block' }} />
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Processing rows…</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>This may take a moment</div>
                </>
              ) : file ? (
                <>
                  <FileSpreadsheet size={40} style={{ color: 'var(--success)', margin: '0 auto 12px', display: 'block' }} />
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{file.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                    {(file.size / 1024).toFixed(1)} KB — ready to import
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); reset() }}>
                    <RotateCcw size={13} /> Choose different file
                  </button>
                </>
              ) : (
                <>
                  <Upload size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 12px', display: 'block' }} />
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
                    Drop your Excel file here
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    or click to browse (.xlsx, .xls)
                  </div>
                </>
              )}
            </div>
          )}

          {/* Import button */}
          {file && !result && (
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => mutation.mutate(file)} disabled={mutation.isPending}>
              {mutation.isPending
                ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Importing…</>
                : <><Upload size={15} /> Import Employees</>}
            </button>
          )}

          {/* Results */}
          {result && (
            <div>
              {/* Summary banner */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20,
              }}>
                <div style={{ padding: '16px 20px', borderRadius: 10,
                  background: 'var(--success-light)', textAlign: 'center' }}>
                  <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--success)' }}>
                    {result.successCount}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>
                    Imported
                  </div>
                </div>
                <div style={{ padding: '16px 20px', borderRadius: 10,
                  background: result.failureCount > 0 ? 'var(--danger-light)' : 'var(--bg-tertiary)',
                  textAlign: 'center' }}>
                  <div style={{ fontSize: 32, fontWeight: 800,
                    color: result.failureCount > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                    {result.failureCount}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600,
                    color: result.failureCount > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                    Failed
                  </div>
                </div>
              </div>

              {/* Created employees */}
              {result.createdEmployees?.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10,
                    textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
                    Created Employees
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {result.createdEmployees.map(e => (
                      <div key={e.empId} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 12px', background: 'var(--success-light)',
                        borderRadius: 8, fontSize: 13,
                      }}>
                        <CheckCircle size={14} color="var(--success)" />
                        <span style={{ fontWeight: 600, color: 'var(--success)' }}>{e.empId}</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{e.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Errors */}
              {result.errors?.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10,
                    textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
                    Errors
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {result.errors.map((e, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                        padding: '8px 12px', background: 'var(--danger-light)',
                        borderRadius: 8, fontSize: 12,
                      }}>
                        <AlertCircle size={14} color="var(--danger)" style={{ flexShrink: 0, marginTop: 1 }} />
                        <div>
                          <span style={{ fontWeight: 600, color: 'var(--danger)' }}>
                            Row {e.rowNumber}
                          </span>
                          <span style={{ color: 'var(--text-secondary)', marginLeft: 6 }}>
                            {e.message}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }}
                  onClick={reset}>
                  <RotateCcw size={14} /> Import More
                </button>
                <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}
                  onClick={onClose}>
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </FocusTrap>
  )
}
