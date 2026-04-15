import { ChevronLeft, ChevronRight } from 'lucide-react'
export default function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null
  const getPages = () => {
    if (totalPages<=7) return Array.from({length:totalPages},(_,i)=>i)
    const pages=[0]; const delta=2; const start=Math.max(1,page-delta); const end=Math.min(totalPages-2,page+delta)
    if(start>1)pages.push('…'); for(let i=start;i<=end;i++)pages.push(i); if(end<totalPages-2)pages.push('…'); pages.push(totalPages-1); return pages
  }
  return (
    <div className="pagination">
      <button className="page-btn" disabled={page===0} onClick={()=>onPageChange(page-1)} aria-label="Previous page"><ChevronLeft size={14}/></button>
      {getPages().map((p,i) => p==='…' ? <span key={`e${i}`} style={{ color:'var(--text-muted)', padding:'0 4px', fontSize:13 }}>…</span> :
        <button key={p} className={`page-btn ${p===page?'active':''}`} onClick={()=>onPageChange(p)} aria-label={`Page ${p+1}`} aria-current={p===page?'page':undefined}>{p+1}</button>)}
      <button className="page-btn" disabled={page>=totalPages-1} onClick={()=>onPageChange(page+1)} aria-label="Next page"><ChevronRight size={14}/></button>
    </div>
  )
}
