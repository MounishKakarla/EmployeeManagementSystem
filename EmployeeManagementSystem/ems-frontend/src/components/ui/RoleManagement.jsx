import { ShieldPlus, ShieldMinus } from 'lucide-react'
import Modal from './Modal'
export default function RoleManagement({ empId, currentRoles, allRoles, onAssign, onRemove, assignOpen, setAssignOpen, removeOpen, setRemoveOpen, assignRole, setAssignRole, removeRole, setRemoveRole, loading }) {
  const assignable=allRoles.filter(r=>!currentRoles.includes(r)); const removable=allRoles.filter(r=>currentRoles.includes(r))
  return (
    <>
      <div style={{ display:'flex', gap:10, marginTop:12 }}>
        <button className="btn btn-secondary btn-sm" onClick={()=>setAssignOpen(true)}><ShieldPlus size={14}/> Assign Role</button>
        <button className="btn btn-secondary btn-sm" onClick={()=>setRemoveOpen(true)}><ShieldMinus size={14}/> Remove Role</button>
      </div>
      <Modal open={assignOpen} onClose={()=>{setAssignOpen(false);setAssignRole('')}} title="Assign Role" footer={<><button className="btn btn-secondary" onClick={()=>{setAssignOpen(false);setAssignRole('')}}>Cancel</button><button className="btn btn-primary" onClick={()=>onAssign(assignRole)} disabled={!assignRole||loading}>{loading?'Assigning…':'Assign Role'}</button></>}>
        <div className="form-group"><label className="form-label">Select Role</label><select className="form-select" value={assignRole} onChange={e=>setAssignRole(e.target.value)}><option value="">Choose a role…</option>{assignable.map(r=><option key={r} value={r}>{r}</option>)}</select></div>
      </Modal>
      <Modal open={removeOpen} onClose={()=>{setRemoveOpen(false);setRemoveRole('')}} title="Remove Role" footer={<><button className="btn btn-secondary" onClick={()=>{setRemoveOpen(false);setRemoveRole('')}}>Cancel</button><button className="btn btn-danger" onClick={()=>onRemove(removeRole)} disabled={!removeRole||loading}>{loading?'Removing…':'Remove Role'}</button></>}>
        <div className="form-group"><label className="form-label">Select Role to Remove</label><select className="form-select" value={removeRole} onChange={e=>setRemoveRole(e.target.value)}><option value="">Choose a role…</option>{removable.map(r=><option key={r} value={r}>{r}</option>)}</select></div>
      </Modal>
    </>
  )
}
