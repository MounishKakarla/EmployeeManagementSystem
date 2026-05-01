import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import useDocumentTitle from '../hooks/useDocumentTitle'
import { employeeAPI, authAPI } from '../api'
import { parseApiError } from '../utils/errorUtils'
import {
  Mail, Phone, MapPin, Building2, Briefcase, Calendar, User,
  Lock, Eye, EyeOff, ChevronDown, ChevronUp, Gift, UserCircle,
  Camera, Trash2
} from 'lucide-react'
import { formatDate } from '../utils/dateUtils'
import toast from 'react-hot-toast'
import '../styles/profile.css'

export default function ProfilePage() {
  const { user, logout } = useAuth()
  const queryClient = useQueryClient()
  useDocumentTitle('My Profile | TekSphere')

  const [showPwdForm,  setShowPwdForm]  = useState(false)
  const [showCurrent,  setShowCurrent]  = useState(false)
  const [showNew,      setShowNew]      = useState(false)
  const [showConfirm,  setShowConfirm]  = useState(false)
  const [currentPwd,   setCurrentPwd]   = useState('')
  const [newPwd,       setNewPwd]       = useState('')
  const [confirmPwd,   setConfirmPwd]   = useState('')
  const fileInputRef = useRef(null)

  const { data, isLoading } = useQuery({ queryKey:['profile'], queryFn:()=>employeeAPI.getProfile() })
  const profile  = data?.data
  const initials = profile?.name?.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase() || user?.empId?.slice(0,2)

  const imageMutation = useMutation({
    mutationFn: (base64) => employeeAPI.updateProfileImage(base64),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      toast.success(imageMutation.variables === null ? 'Profile image removed' : 'Profile image updated')
    },
    onError: (err) => toast.error(parseApiError(err, 'Failed to update profile image')),
  })

  const handleImagePick = () => fileInputRef.current?.click()

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return }
    if (file.size > 2 * 1024 * 1024) { toast.error('Image must be under 2 MB'); return }
    const reader = new FileReader()
    reader.onload = () => imageMutation.mutate(reader.result)
    reader.readAsDataURL(file)
    e.target.value = '' // reset so same file can be re-selected
  }

  const handleRemoveImage = () => imageMutation.mutate(null)

  const changePwdMutation = useMutation({
    mutationFn: () => authAPI.changePassword({ currentPassword: currentPwd, newPassword: newPwd }),
    onSuccess: () => {
      toast.success('Password changed. You will be logged out.')
      setTimeout(() => logout(), 1500)
    },
    onError: (err) => toast.error(parseApiError(err, 'Failed to change password')),
  })

  const handleChangePassword = () => {
    if (!currentPwd || !newPwd || !confirmPwd) { toast.error('All fields are required'); return }
    if (newPwd !== confirmPwd)   { toast.error('New passwords do not match'); return }
    if (newPwd.length < 6)       { toast.error('Password must be at least 6 characters'); return }
    changePwdMutation.mutate()
  }

  if (isLoading) return <div style={{ display:'flex', justifyContent:'center', padding:80 }}><div className="spinner" style={{ width:28, height:28 }}/></div>

  return (
    <div className="profile-page">
      <div className="profile-container">
        <div className="profile-page-header"><h1>My Profile</h1><p>Your personal and employment information</p></div>

        {/* Hero card */}
        <div className="card profile-hero">
          {/* ── Profile image with upload overlay ── */}
          <div className="profile-avatar-wrap">
            {profile?.profileImage ? (
              <img src={profile.profileImage} alt={profile.name} className="profile-avatar-img" />
            ) : (
              <div className="avatar avatar-xl profile-avatar">{initials}</div>
            )}
            <button
              className="profile-avatar-overlay"
              onClick={handleImagePick}
              disabled={imageMutation.isPending}
              title="Change profile photo"
            >
              {imageMutation.isPending
                ? <span className="spinner" style={{ width:18, height:18 }}/>
                : <Camera size={18} color="#fff"/>}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display:'none' }}
            />
          </div>
          {profile?.profileImage && (
            <button
              className="profile-remove-img-btn"
              onClick={handleRemoveImage}
              disabled={imageMutation.isPending}
            >
              <Trash2 size={12}/> Remove Photo
            </button>
          )}

          <div className="profile-hero-info">
            <h2>{profile?.name || user?.empId}</h2>
            <div className="profile-badges">
              {profile?.department  && <span className="badge badge-info">{profile.department}</span>}
              {profile?.designation && <span style={{ color:'var(--text-secondary)', fontSize:14 }}>{profile.designation}</span>}
            </div>
            <div style={{ marginTop:8, display:'flex', gap:6, flexWrap:'wrap', justifyContent:'center' }}>
              {user?.roles?.map(r => <span key={r} className={`badge role-${r.toLowerCase()}`}>{r}</span>)}
            </div>
          </div>
        </div>

        {profile ? (
          <div className="profile-cards grid-2">
            {/* Contact information */}
            <div className="card">
              <div className="card-header"><h3 className="card-title">Contact Information</h3><Mail size={16} style={{ color:'var(--text-muted)' }}/></div>
              <div className="profile-fields">
                <ProfileField icon={User}    label="Employee ID"    value={profile.empId}/>
                <ProfileField icon={Mail}    label="Company Email"  value={profile.companyEmail}/>
                <ProfileField icon={Mail}    label="Personal Email" value={profile.personalEmail}/>
                <ProfileField icon={Phone}   label="Phone"          value={profile.phoneNumber}/>
                <ProfileField icon={MapPin}  label="Address"        value={profile.address}/>
                <ProfileField icon={UserCircle} label="Gender"      value={profile.gender}/>
              </div>
            </div>

            {/* Employment details */}
            <div className="card">
              <div className="card-header"><h3 className="card-title">Employment Details</h3><Briefcase size={16} style={{ color:'var(--text-muted)' }}/></div>
              <div className="profile-fields">
                <ProfileField icon={Building2} label="Department"      value={profile.department}/>
                <ProfileField icon={Briefcase} label="Designation"     value={profile.designation}/>
                <ProfileField icon={Calendar}  label="Date of Joining" value={formatDate(profile.dateOfJoin)}/>
                <ProfileField icon={Gift}      label="Date of Birth"   value={formatDate(profile.dateOfBirth)}/>
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

        {/* ── Change Password ─────────────────────────────────────────────── */}
        <div className="card">
          <button className="profile-pwd-toggle" onClick={() => setShowPwdForm(v => !v)}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div className="profile-field-icon"><Lock size={14} color="var(--text-muted)"/></div>
              <div>
                <div className="card-title" style={{ margin:0 }}>Change Password</div>
                <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>Update your account password</div>
              </div>
            </div>
            {showPwdForm ? <ChevronUp size={18} color="var(--text-muted)"/> : <ChevronDown size={18} color="var(--text-muted)"/>}
          </button>

          {showPwdForm && (
            <div className="profile-pwd-form">
              <PwdInput
                label="Current Password"
                value={currentPwd}
                onChange={setCurrentPwd}
                show={showCurrent}
                onToggle={() => setShowCurrent(v => !v)}
                placeholder="Your current password"
              />
              <PwdInput
                label="New Password"
                value={newPwd}
                onChange={setNewPwd}
                show={showNew}
                onToggle={() => setShowNew(v => !v)}
                placeholder="At least 6 characters"
              />
              <PwdInput
                label="Confirm New Password"
                value={confirmPwd}
                onChange={setConfirmPwd}
                show={showConfirm}
                onToggle={() => setShowConfirm(v => !v)}
                placeholder="Repeat new password"
              />
              {newPwd && confirmPwd && newPwd !== confirmPwd && (
                <p style={{ color:'var(--danger)', fontSize:12, margin:'0 0 8px' }}>Passwords do not match</p>
              )}
              <div style={{ display:'flex', gap:10, marginTop:4 }}>
                <button className="btn btn-secondary" onClick={() => { setShowPwdForm(false); setCurrentPwd(''); setNewPwd(''); setConfirmPwd('') }}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleChangePassword}
                  disabled={changePwdMutation.isPending || !currentPwd || !newPwd || !confirmPwd}
                >
                  {changePwdMutation.isPending
                    ? <><span className="spinner" style={{ width:14, height:14 }}/> Saving…</>
                    : <><Lock size={14}/> Update Password</>}
                </button>
              </div>
            </div>
          )}
        </div>

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

function PwdInput({ label, value, onChange, show, onToggle, placeholder }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <div className="profile-pwd-input-wrap">
        <input
          className="form-input"
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ paddingRight: 42 }}
        />
        <button type="button" className="profile-pwd-eye" onClick={onToggle} tabIndex={-1}>
          {show ? <EyeOff size={15} color="var(--text-muted)"/> : <Eye size={15} color="var(--text-muted)"/>}
        </button>
      </div>
    </div>
  )
}
