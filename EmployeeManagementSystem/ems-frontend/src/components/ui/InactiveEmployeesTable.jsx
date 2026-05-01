import { useState } from 'react'
import { UserX, Users, Eye, Search, AlertCircle, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { formatDate } from '../../utils/dateUtils'
import { parseApiError } from '../../utils/errorUtils'
import Pagination from './Pagination'
import { useUIStore } from '../../store/uiStore'

const PAGE_SIZE=10
const DEPARTMENTS=['DEVELOPMENT','FINANCE','DESIGN','HR','SALES','MARKETING','SUPPORT','ADMINISTRATION','HOSPITALITY','PROCUREMENT','QUALITY ASSURANCE','TRAINING','SECURITY','MAINTENANCE','CUSTOMER CARE','BUSINESS DEVELOPMENT','STRATEGY','EXECUTIVE LEADERSHIP']

function SortIcon({field,sortField,sortDir}){
  if(sortField!==field)return<ArrowUpDown size={12} style={{opacity:0.3}}/>
  return sortDir==='asc'?<ArrowUp size={12} style={{color:'var(--accent)'}}/>:<ArrowDown size={12} style={{color:'var(--accent)'}}/>
}

export default function InactiveEmployeesTable({allEmployees,isLoading,error,refetch}){
  const{openEmployeeSheet}=useUIStore()
  const[page,setPage]=useState(0)
  const[searchName,setSearchName]=useState('')
  const[filterDept,setFilterDept]=useState('')
  const[sortField,setSortField]=useState('empId')
  const[sortDir,setSortDir]=useState('asc')
  const filtered=allEmployees.filter(e=>{const nm=!searchName||e.name?.toLowerCase().includes(searchName.toLowerCase());const depts=e.department?.split(',').map(s=>s.trim().toUpperCase())||[];const dm=!filterDept||depts.includes(filterDept.toUpperCase());return nm&&dm})
  const sorted=[...filtered].sort((a,b)=>{const av=(a[sortField]||'').toString().toLowerCase();const bv=(b[sortField]||'').toString().toLowerCase();const cmp=av<bv?-1:av>bv?1:0;return sortDir==='asc'?cmp:-cmp})
  const totalElements=sorted.length;const totalPages=Math.ceil(totalElements/PAGE_SIZE);const employees=sorted.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE)
  const handleSort=field=>{if(sortField===field)setSortDir(d=>d==='asc'?'desc':'asc');else{setSortField(field);setSortDir('asc')};setPage(0)}
  const clearFilters=()=>{setSearchName('');setFilterDept('');setPage(0)};const hasFilters=searchName||filterDept
  return(
    <div>
      <div style={{marginBottom:16}}><p className="page-subtitle">{isLoading?'Loading…':`${allEmployees.length} deactivated employee${allEmployees.length!==1?'s':''}${hasFilters?` — ${totalElements} match${totalElements!==1?'es':''}`:''}`}</p></div>
      <div className="card card-sm">
        <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'flex-end'}}>
          <div style={{flex:'1 1 200px'}}><label className="form-label">Search by Name</label><div className="search-box"><Search size={14}/><input className="form-input" placeholder="Type employee name…" value={searchName} onChange={e=>{setSearchName(e.target.value);setPage(0)}}/></div></div>
          <div style={{flex:'0 1 200px'}}><label className="form-label">Department</label><select className="form-select" value={filterDept} onChange={e=>{setFilterDept(e.target.value);setPage(0)}}><option value="">All Departments</option>{DEPARTMENTS.map(d=><option key={d} value={d}>{d}</option>)}</select></div>
          {hasFilters&&<button className="btn btn-ghost btn-sm" onClick={clearFilters} style={{alignSelf:'flex-end'}}>Clear</button>}
        </div>
      </div>
      {error&&<div className="error-banner"><AlertCircle size={16}/><span style={{flex:1}}>{parseApiError(error,'Failed to load inactive employees.')}</span><button className="btn btn-ghost btn-sm" onClick={()=>refetch()}><RefreshCw size={13}/> Retry</button></div>}
      <div className="card" style={{padding:0}}>
        {isLoading?(<div style={{padding:60,display:'flex',justifyContent:'center'}}><div className="spinner" style={{width:28,height:28}}/></div>
        ):employees.length===0?(<div className="empty-state"><Users size={40}/><h3>{hasFilters?'No matches found':'No inactive employees'}</h3><p style={{fontSize:14}}>{hasFilters?'Try adjusting your filters':'All employees are currently active'}</p>{hasFilters&&<button className="btn btn-secondary btn-sm" onClick={clearFilters}>Clear Filters</button>}</div>
        ):(<>
          <div className="table-wrapper" style={{border:'none',borderRadius:0,overflowX:'auto'}}>
            <table>
              <thead><tr>{[{key:'empId',label:'ID'},{key:'name',label:'Name'},{key:'department',label:'Department'},{key:'designation',label:'Designation'},{key:'dateOfJoin',label:'Joined'}].map(col=>(
                <th key={col.key} onClick={()=>handleSort(col.key)} style={{cursor:'pointer',userSelect:'none',whiteSpace:'nowrap'}}><span style={{display:'inline-flex',alignItems:'center',gap:4}}>{col.label}<SortIcon field={col.key} sortField={sortField} sortDir={sortDir}/></span></th>
              ))}<th>Status</th><th>Actions</th></tr></thead>
              <tbody>{employees.map(emp=>{
                const initials=emp.name?.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()||'??'
                const depts=emp.department?.split(',').map(s=>s.trim()).filter(Boolean)||[]
                const desigs=emp.designation?.split(',').map(s=>s.trim()).filter(Boolean)||[]
                const goTo=()=>openEmployeeSheet(emp.empId,true)
                return(<tr key={emp.empId} onClick={goTo} style={{cursor:'pointer'}}>
                  <td style={{fontFamily:'var(--font-display)',fontWeight:600,fontSize:13}}>{emp.empId}</td>
                  <td><div style={{display:'flex',alignItems:'center',gap:10}}>{emp.profileImage ? <img src={emp.profileImage} alt={emp.name} style={{width:32,height:32,borderRadius:'50%',objectFit:'cover',border:'2px solid var(--border)',opacity:0.6}}/> : <div className="avatar" style={{background:'var(--bg-tertiary)',color:'var(--text-muted)'}}>{initials}</div>}<div><div style={{fontWeight:500,fontSize:14}}>{emp.name}</div><div style={{fontSize:12,color:'var(--text-muted)'}}>{emp.companyEmail}</div></div></div></td>
                  <td><div style={{display:'flex',gap:4,flexWrap:'wrap'}}>{depts.slice(0,2).map(d=><span key={d} className="badge badge-neutral" style={{fontSize:11}}>{d}</span>)}{depts.length>2&&<span className="badge badge-neutral" style={{fontSize:11}}>+{depts.length-2}</span>}</div></td>
                  <td style={{color:'var(--text-secondary)',fontSize:13}}>{desigs.slice(0,2).join(', ')}{desigs.length>2?` +${desigs.length-2}`:''}</td>
                  <td style={{color:'var(--text-muted)',fontSize:13}}>{formatDate(emp.dateOfJoin)}</td>
                  <td><div style={{display:'flex',alignItems:'center',gap:6,fontSize:13,color:'var(--danger)'}}><UserX size={13}/> Deactivated</div></td>
                  <td onClick={e=>e.stopPropagation()}><button className="btn btn-ghost btn-sm" onClick={goTo}><Eye size={13}/> View</button></td>
                </tr>)
              })}</tbody>
            </table>
          </div>
          <div className="pagination-bar">
            <span className="pagination-info">Showing {Math.min(page*PAGE_SIZE+1,totalElements)}–{Math.min((page+1)*PAGE_SIZE,totalElements)} of {totalElements}</span>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage}/>
            <span className="pagination-info">Page {page+1} of {Math.max(1,totalPages)}</span>
          </div>
        </>)}
      </div>
    </div>
  )
}
