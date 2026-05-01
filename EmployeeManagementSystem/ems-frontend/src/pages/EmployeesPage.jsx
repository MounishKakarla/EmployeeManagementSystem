import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { employeeAPI } from '../api'
import { Search, UserPlus, Users, Eye, AlertCircle, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown, Download, FileSpreadsheet } from 'lucide-react'
import { AnimatePresence } from 'framer-motion'
import useDocumentTitle from '../hooks/useDocumentTitle'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useUIStore } from '../store/uiStore'
import { formatDate } from '../utils/dateUtils'
import { parseApiError } from '../utils/errorUtils'
import { exportToCSV } from '../utils/csvUtils'
import Skeleton from '../components/ui/Skeleton'
import InactiveEmployeesTable from '../components/ui/InactiveEmployeesTable'
import ImportEmployeeSheet from '../components/excel/ImportEmployeeSheet'
import toast from 'react-hot-toast'
import '../styles/employees.css'

const DEPARTMENTS = ['DEVELOPMENT','FINANCE','DESIGN','HR','SALES','MARKETING','SUPPORT','ADMINISTRATION','HOSPITALITY','PROCUREMENT','QUALITY ASSURANCE','TRAINING','SECURITY','MAINTENANCE','CUSTOMER CARE','BUSINESS DEVELOPMENT','STRATEGY','EXECUTIVE LEADERSHIP']
const PAGE_SIZE = 15
const COLUMNS = [
  { key:'empId',       label:'ID',          sortable:true  },
  { key:'name',        label:'Name',        sortable:true  },
  { key:'department',  label:'Department',  sortable:true  },
  { key:'designation', label:'Designation', sortable:false },
  { key:'phoneNumber', label:'Phone',       sortable:false },
  { key:'dateOfJoin',  label:'Joined',      sortable:true  },
]

function SortIcon({ field, sortField, sortDir }) {
  if (sortField !== field) return <ArrowUpDown size={12} style={{ opacity:0.3 }}/>
  return sortDir==='asc' ? <ArrowUp size={12} style={{ color:'var(--accent)' }}/> : <ArrowDown size={12} style={{ color:'var(--accent)' }}/>
}

export default function EmployeesPage() {
  const { isAdmin } = useAuth()
  const qc = useQueryClient()
  useDocumentTitle('Employees | Tektalis EMS')
  const [searchParams] = useSearchParams()
  const { isNewEmployeeSheetOpen, setNewEmployeeSheetOpen } = useUIStore()
  const [activeTab,  setActiveTab]  = useState(() => {
    const tab = searchParams.get('tab')
    return tab === 'inactive' ? 'inactive' : 'active'
  })
  const [searchName, setSearchName] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [sortField,  setSortField]  = useState('empId')
  const [sortDir,    setSortDir]    = useState('asc')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [importOpen, setImportOpen] = useState(false)

  useEffect(() => { const t=setTimeout(()=>setDebouncedSearch(searchName),300); return ()=>clearTimeout(t) }, [searchName])

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'active' || tab === 'inactive') {
      setActiveTab(tab)
    }
  }, [searchParams])

  const handleSort = useCallback((field) => {
    if (!field) return
    if (sortField===field) setSortDir(d=>d==='asc'?'desc':'asc')
    else { setSortField(field); setSortDir('asc') }
  }, [sortField])

  const { data, isLoading, isFetching, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['employees-infinite',{debouncedSearch,filterDept,filterDate,sortField,sortDir}],
    queryFn: ({pageParam=0}) => employeeAPI.search({ page:pageParam, size:PAGE_SIZE, sort:`${sortField},${sortDir}`, ...(debouncedSearch?{name:debouncedSearch}:{}), ...(filterDept?{department:filterDept}:{}), ...(filterDate?{date:filterDate}:{}) }),
    getNextPageParam: (lastPage) => { const c=lastPage.data.number, t=lastPage.data.totalPages; return c+1<t?c+1:undefined },
    retry: (count,err) => err?.response?.status===401 ? false : count<2,
  })

  const employees     = data?.pages.flatMap(p=>p.data.content) || []
  const totalElements = data?.pages[0]?.data.totalElements || 0

  const { data: inactiveData, isLoading: isInactiveLoading, error: inactiveError, refetch: refetchInactive } = useQuery({
    queryKey: ['employees','inactive-all'],
    queryFn:  ()=>employeeAPI.getInactive({page:0,size:1000}),
    enabled: activeTab==='inactive',
  })
  const allInactiveEmployees = inactiveData?.data?.content || []

  const clearFilters = () => { setSearchName(''); setFilterDept(''); setFilterDate('') }
  const hasFilters   = searchName || filterDept || filterDate

  const handleExport = () => {
    if (activeTab==='active') { exportToCSV(employees,'active_employees.csv'); toast.success(`Exported ${employees.length} employees`) }
    else { exportToCSV(allInactiveEmployees,'inactive_employees.csv'); toast.success(`Exported ${allInactiveEmployees.length} inactive employees`) }
  }

  const parentRef = useRef(null)
  const rowVirtualizer = useVirtualizer({ count: hasNextPage?employees.length+1:employees.length, getScrollElement:()=>parentRef.current, estimateSize:()=>64, overscan:5 })

  useEffect(() => {
    const virtualItems = rowVirtualizer.getVirtualItems()
    const lastItem = virtualItems[virtualItems.length-1]
    if (!lastItem) return
    if (lastItem.index>=employees.length-1 && hasNextPage && !isFetchingNextPage) fetchNextPage()
  }, [rowVirtualizer.getVirtualItems(), hasNextPage, isFetchingNextPage, employees.length, fetchNextPage])

  return (
    <div className="employees-page">
      <div className="page-header">
        <div>
          <h1>Employees</h1>
          <p className="page-subtitle">{isLoading?'Loading…':`${totalElements} active employee${totalElements!==1?'s':''}`}</p>
        </div>
        {isAdmin() && (
          <div style={{ display:'flex', gap:10 }}>
            <button className="btn btn-ghost" onClick={handleExport}><Download size={15}/> Export</button>
            <button className="btn btn-ghost" onClick={()=>setImportOpen(true)}><FileSpreadsheet size={15}/> Import</button>
            <button className="btn btn-primary" onClick={()=>setNewEmployeeSheetOpen(true)}><UserPlus size={15}/> Add Employee</button>
          </div>
        )}
      </div>

      <div style={{ display:'flex', gap:16, marginBottom:24, borderBottom:'1px solid var(--border)' }}>
        {['active','inactive'].map(tab => (
          <button key={tab} onClick={()=>setActiveTab(tab)} style={{ background:'none', border:'none', padding:'10px 16px', fontSize:14, fontWeight:500, borderBottom:activeTab===tab?'2px solid var(--accent)':'2px solid transparent', color:activeTab===tab?'var(--text-primary)':'var(--text-muted)', cursor:'pointer', transition:'all 0.2s', textTransform:'capitalize' }}>{tab}</button>
        ))}
      </div>

      {activeTab==='inactive' ? (
        <InactiveEmployeesTable allEmployees={allInactiveEmployees} isLoading={isInactiveLoading} error={inactiveError} refetch={refetchInactive}/>
      ) : (
        <>
          <div className="card card-sm filter-bar">
            <div className="filter-row">
              <div className="filter-field filter-field-grow">
                <label className="form-label">Search by Name</label>
                <div className="search-box"><Search size={14}/><input className="form-input" placeholder="Type employee name…" value={searchName} onChange={e=>{setSearchName(e.target.value);setFilterDept('');setFilterDate('')}}/></div>
              </div>
              <div className="filter-field">
                <label className="form-label">Department</label>
                <select className="form-select" value={filterDept} onChange={e=>{setFilterDept(e.target.value);setSearchName('');setFilterDate('')}}>
                  <option value="">All Departments</option>
                  {DEPARTMENTS.map(d=><option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="filter-field">
                <label className="form-label">Joined After</label>
                <input type="date" className="form-input" value={filterDate} onChange={e=>{setFilterDate(e.target.value);setSearchName('');setFilterDept('')}}/>
              </div>
              {hasFilters && <button className="btn btn-ghost btn-sm" onClick={clearFilters} style={{ alignSelf:'flex-end' }}>Clear</button>}
            </div>
          </div>

          {error && (
            <div className="error-banner"><AlertCircle size={16}/><span style={{ flex:1 }}>{parseApiError(error,'Failed to load employees.')}</span><button className="btn btn-ghost btn-sm" onClick={()=>refetch()}><RefreshCw size={13}/> Retry</button></div>
          )}

          <div className="card" style={{ padding:0 }}>
            {isLoading ? (
              <div className="table-wrapper" style={{ border:'none', borderRadius:0 }}><table><thead><tr>{COLUMNS.map(c=><th key={c.key}>{c.label}</th>)}<th>Actions</th></tr></thead><tbody>{Array.from({length:10}).map((_,i)=><tr key={i}><td><Skeleton height="16px" width="60px"/></td><td><div style={{ display:'flex',gap:10,alignItems:'center' }}><Skeleton height="36px" width="36px" borderRadius="50%"/><div style={{ display:'flex',flexDirection:'column',gap:4 }}><Skeleton height="16px" width="120px"/><Skeleton height="12px" width="160px"/></div></div></td><td><Skeleton height="22px" width="80px" borderRadius="100px"/></td><td><Skeleton height="16px" width="100px"/></td><td><Skeleton height="16px" width="90px"/></td><td><Skeleton height="16px" width="80px"/></td><td><Skeleton height="28px" width="60px" borderRadius="4px"/></td></tr>)}</tbody></table></div>
            ) : employees.length===0 && !error ? (
              <div className="empty-state"><Users size={40}/><h3>No employees found</h3><p style={{ fontSize:14 }}>Try adjusting your search or filters</p>{hasFilters&&<button className="btn btn-secondary btn-sm" onClick={clearFilters}>Clear Filters</button>}</div>
            ) : (
              <>
                <div className="table-wrapper virtual-grid-container" ref={parentRef} style={{ border:'none', borderRadius:0, overflowX:'auto' }}>
                  <table style={{ display:'table', width:'100%' }}>
                    <thead style={{ position:'sticky', top:0, zIndex:10, background:'var(--bg-card)', boxShadow:'0 1px 0 var(--border)' }}>
                      <tr>
                        {COLUMNS.map(col=>(
                          <th key={col.key} onClick={()=>col.sortable&&handleSort(col.key)} style={{ cursor:col.sortable?'pointer':'default', userSelect:'none', whiteSpace:'nowrap', borderBottom:'none' }}>
                            <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}>{col.label}{col.sortable&&<SortIcon field={col.key} sortField={sortField} sortDir={sortDir}/>}</span>
                          </th>
                        ))}
                        <th style={{ borderBottom:'none' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rowVirtualizer.getVirtualItems().length>0&&<tr style={{ height:rowVirtualizer.getVirtualItems()[0].start }}/>}
                      {rowVirtualizer.getVirtualItems().map(virtualRow=>{
                        const isLoaderRow = virtualRow.index > employees.length-1
                        const emp = employees[virtualRow.index]
                        if (isLoaderRow) return (
                          <tr key={virtualRow.key} ref={rowVirtualizer.measureElement} data-index={virtualRow.index}>
                            <td colSpan={7} style={{ textAlign:'center', padding:'30px' }}><div className="spinner" style={{ width:24, height:24, margin:'0 auto' }}/><span style={{ fontSize:12, color:'var(--text-muted)', display:'block', marginTop:8 }}>Loading more...</span></td>
                          </tr>
                        )
                        return <EmployeeRow key={virtualRow.key} emp={emp} ref={rowVirtualizer.measureElement} data-index={virtualRow.index}/>
                      })}
                      {rowVirtualizer.getVirtualItems().length>0&&<tr style={{ height:rowVirtualizer.getTotalSize()-rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length-1].end }}/>}
                    </tbody>
                  </table>
                </div>
                <div className="pagination-bar" style={{ justifyContent:'space-between', padding:'16px 24px' }}>
                  <span className="pagination-info" style={{ display:'flex', alignItems:'center', gap:8 }}>
                    {isFetching&&!isFetchingNextPage&&<span className="spinner" style={{ width:12, height:12 }}/>}
                    Loaded {employees.length} of {totalElements} employees
                  </span>
                  <span className="pagination-info" style={{ color:'var(--success)' }}>Infinite Scroll Active</span>
                </div>
              </>
            )}
          </div>
        </>
      )}

      <AnimatePresence>
        {importOpen && <ImportEmployeeSheet onClose={()=>setImportOpen(false)} onSuccess={()=>qc.invalidateQueries({queryKey:['employees-infinite']})}/>}
      </AnimatePresence>
    </div>
  )
}

const EmployeeRow = React.forwardRef(({ emp, 'data-index': dataIndex }, ref) => {
  const { openEmployeeSheet } = useUIStore()
  const initials = emp.name?.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()||'??'
  const depts    = emp.department?.split(',').map(s=>s.trim()).filter(Boolean)||[]
  const desigs   = emp.designation?.split(',').map(s=>s.trim()).filter(Boolean)||[]
  return (
    <tr ref={ref} data-index={dataIndex} onClick={(e)=>{if(e.target.closest('button'))return;openEmployeeSheet(emp.empId)}} style={{ cursor:'pointer' }} title="Click to view & edit">
      <td style={{ fontFamily:'var(--font-display)', fontWeight:600, fontSize:13, color:'var(--accent)' }}>{emp.empId}</td>
      <td><div style={{ display:'flex', alignItems:'center', gap:10 }}>
        {emp.profileImage
          ? <img src={emp.profileImage} alt={emp.name} style={{ width:36, height:36, borderRadius:'50%', objectFit:'cover', border:'2px solid var(--border)', flexShrink:0 }}/>
          : <div className="avatar">{initials}</div>}
        <div><div style={{ fontWeight:500, fontSize:14 }}>{emp.name}</div><div style={{ fontSize:12, color:'var(--text-muted)' }}>{emp.companyEmail}</div></div>
      </div></td>
      <td><div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>{depts.slice(0,2).map(d=><span key={d} className="badge badge-info" style={{ fontSize:11 }}>{d}</span>)}{depts.length>2&&<span className="badge badge-neutral" style={{ fontSize:11 }}>+{depts.length-2}</span>}</div></td>
      <td style={{ color:'var(--text-secondary)', fontSize:13 }}>{desigs.slice(0,2).join(', ')}{desigs.length>2?` +${desigs.length-2}`:''}</td>
      <td style={{ color:'var(--text-secondary)', fontSize:13 }}>{emp.phoneNumber}</td>
      <td style={{ color:'var(--text-muted)', fontSize:13 }}>{formatDate(emp.dateOfJoin)}</td>
      <td onClick={e=>e.stopPropagation()}><button className="btn btn-ghost btn-sm" onClick={()=>openEmployeeSheet(emp.empId)}><Eye size={13}/> View</button></td>
    </tr>
  )
})
