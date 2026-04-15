import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import useDocumentTitle from '../hooks/useDocumentTitle'
import { employeeAPI } from '../api'
import { Mail, Phone, MapPin, Building2, Briefcase, Calendar, User } from 'lucide-react'
import { formatDate } from '../utils/dateUtils'
import '../styles/profile.css'

export default function ProfilePage() {
  const { user } = useAuth()
  useDocumentTitle('My Profile | Tektalis EMS')
  const { data, isLoading } = useQuery({ queryKey:['profile'], queryFn:()=>employeeAPI.getProfile() })
  const profile  = data?.data
  const initials = profile?.name?.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase() || user?.empId?.slice(0,2)

  if (isLoading) return <div style={{ display:'flex', justifyContent:'center', padding:80 }}><div className="spinner" style={{ width:28, height:28 }}/></div>

  return (
    <div className="profile-page">
      <div className="profile-container">
        <div className="profile-page-header"><h1>My Profile</h1><p>Your personal and employment information</p></div>
        <div className="card profile-hero">
          <div className="avatar avatar-xl profile-avatar">{initials}</div>
          <div className="profile-hero-info">
            <h2>{profile?.name || user?.empId}</h2>
            <div className="profile-badges">
              {profile?.department && <span className="badge badge-info">{profile.department}</span>}
              {profile?.designation && <span style={{ color:'var(--text-secondary)', fontSize:14 }}>{profile.designation}</span>}
            </div>
            <div style={{ marginTop:8, display:'flex', gap:6, flexWrap:'wrap', justifyContent:'center' }}>
              {user?.roles?.map(r => <span key={r} className={`badge role-${r.toLowerCase()}`}>{r}</span>)}
            </div>
          </div>
        </div>
        {profile ? (
          <div className="profile-cards grid-2">
            <div className="card">
              <div className="card-header"><h3 className="card-title">Contact Information</h3><Mail size={16} style={{ color:'var(--text-muted)' }}/></div>
              <div className="profile-fields">
                <ProfileField icon={User}   label="Employee ID"    value={profile.empId}/>
                <ProfileField icon={Mail}   label="Company Email"  value={profile.companyEmail}/>
                <ProfileField icon={Mail}   label="Personal Email" value={profile.personalEmail}/>
                <ProfileField icon={Phone}  label="Phone"          value={profile.phoneNumber}/>
                <ProfileField icon={MapPin} label="Address"        value={profile.address}/>
              </div>
            </div>
            <div className="card">
              <div className="card-header"><h3 className="card-title">Employment Details</h3><Briefcase size={16} style={{ color:'var(--text-muted)' }}/></div>
              <div className="profile-fields">
                <ProfileField icon={Building2} label="Department"      value={profile.department}/>
                <ProfileField icon={Briefcase} label="Designation"     value={profile.designation}/>
                <ProfileField icon={Calendar}  label="Date of Joining" value={formatDate(profile.dateOfJoin)}/>
              </div>
              {profile.skills && <>
                <div className="profile-skills-divider"/>
                <div className="profile-skills-label">Skills</div>
                <div className="profile-skill-chips">
                  {profile.skills.split(',').map(s=>s.trim()).filter(Boolean).map(s => <span key={s} className="profile-skill-chip">{s}</span>)}
                </div>
              </>}
            </div>
          </div>
        ) : (
          <div className="card" style={{ textAlign:'center', padding:'40px 24px' }}><p style={{ color:'var(--text-secondary)' }}>Profile data unavailable</p></div>
        )}
      </div>
    </div>
  )
}

function ProfileField({ icon: Icon, label, value }) {
  return (
    <div className="profile-field">
      <div className="profile-field-icon"><Icon size={14} color="var(--text-muted)"/></div>
      <div>
        <div className="profile-field-label">{label}</div>
        <div className="profile-field-value">{value || '—'}</div>
      </div>
    </div>
  )
}
