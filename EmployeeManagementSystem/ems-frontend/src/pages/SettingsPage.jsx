import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { authAPI } from '../api'
import { useNavigate } from 'react-router-dom'
import { Sun, Moon, Shield, Palette, LogOut, Mail, User } from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import useDocumentTitle from '../hooks/useDocumentTitle'
import { BaseInput, BaseButton } from '../components/ui/BaseComponents'
import { parseApiError } from '../utils/errorUtils'
import '../styles/settings.css'

export default function SettingsPage() {
  const { user, logout }       = useAuth()
  useDocumentTitle('Settings | Tektalis EMS')
  const { theme, toggleTheme } = useTheme()
  const navigate               = useNavigate()
  const [logoutConfirm, setLogoutConfirm] = useState(false)

  const { register, handleSubmit, reset, watch, formState: { errors, isValid } } = useForm({ mode:'onChange' })
  const newPassword = watch('newPassword','')
  const confirmPassword = watch('confirmPassword','')
  const passwordsMatch = newPassword === confirmPassword && confirmPassword !== ''

  const changePwdMutation = useMutation({
    mutationFn: (data) => authAPI.changePassword({ oldPassword:data.oldPassword, newPassword:data.newPassword }),
    onSuccess: () => { toast.success('Password changed. Please sign in again.'); reset(); logout(); navigate('/login') },
    onError: (err) => toast.error(parseApiError(err,'Failed to change password')),
  })

  const handleLogout = async () => { await logout(); toast.success('Signed out'); navigate('/login') }

  return (
    <div className="settings-page">
      <h1>Settings</h1>
      <p>Manage your account preferences</p>
      <div className="settings-stack">

        <div className="card">
          <div className="settings-section-header">
            <div className="settings-section-icon"><Palette size={16} color="var(--accent)"/></div>
            <h3 className="card-title">Appearance</h3>
          </div>
          <div className="settings-appearance-row">
            <div className="settings-theme-label">{theme==='dark'?<Moon size={16}/>:<Sun size={16}/>}<span>{theme} mode</span></div>
            <BaseButton variant="secondary" size="sm" onClick={toggleTheme}>Switch to {theme==='dark'?'light':'dark'}</BaseButton>
          </div>
        </div>

        <div className="card">
          <div className="settings-section-header">
            <div className="settings-section-icon"><Shield size={16} color="var(--accent)"/></div>
            <h3 className="card-title">Change Password</h3>
          </div>
          <form onSubmit={handleSubmit(d=>changePwdMutation.mutate(d))} noValidate>
            <BaseInput label="Current Password" type="password" placeholder="Enter current password"
              error={errors.oldPassword?.message}
              {...register('oldPassword',{required:'Current password is required'})}/>
            <BaseInput label="New Password" type="password" placeholder="Enter new password"
              error={errors.newPassword?.message}
              hint="Min 8 chars — uppercase, lowercase, number & symbol (@$!%*?&)"
              {...register('newPassword',{required:'Password is required',minLength:{value:8,message:'Minimum 8 characters'},
                pattern:{value:/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])/,message:'Must include uppercase, lowercase, number & special char'},
                validate:val=>val!==watch('oldPassword')||'New password must differ from current'})}/>
            <BaseInput label="Confirm New Password" type="password" placeholder="Confirm new password"
              error={errors.confirmPassword?.message}
              {...register('confirmPassword',{required:'Please confirm your password',validate:val=>val===watch('newPassword')||'Passwords do not match'})}/>
            {confirmPassword && !errors.confirmPassword && (
              <p className={`pw-strength ${passwordsMatch?'pw-match-ok':'pw-match-fail'}`}>
                {passwordsMatch ? '✓ Passwords match' : '✗ Passwords do not match'}
              </p>
            )}
            <div style={{ marginTop:24 }}>
              <BaseButton type="submit" variant="primary" loading={changePwdMutation.isPending}
                disabled={!isValid||!passwordsMatch} fullWidth>
                {changePwdMutation.isPending?'Updating…':'Update Password'}
              </BaseButton>
            </div>
          </form>
        </div>

        <div className="card">
          <div className="settings-section-header">
            <div className="settings-section-icon"><User size={16} color="var(--accent)"/></div>
            <h3 className="card-title">Account Info</h3>
          </div>
          <div className="profile-fields" style={{ marginBottom:24 }}>
            <div className="settings-info-row"><span className="settings-info-label"><User size={13}/> Employee ID</span><span className="settings-info-value">{user?.empId}</span></div>
            <div className="settings-divider"/>
            <div className="settings-info-row"><span className="settings-info-label"><Mail size={13}/> Company Email</span><span className="settings-info-value">{user?.companyEmail}</span></div>
            <div className="settings-divider"/>
            <div className="settings-info-row"><span className="settings-info-label">Roles</span>
              <div style={{ display:'flex', gap:4, flexWrap:'wrap', justifyContent:'flex-end' }}>
                {user?.roles?.map(r=><span key={r} className={`badge role-${r.toLowerCase()}`}>{r}</span>)}
              </div>
            </div>
          </div>
          <BaseButton variant="danger" size="sm" icon={LogOut} onClick={()=>setLogoutConfirm(true)} fullWidth>Sign Out</BaseButton>
        </div>
      </div>

      <ConfirmDialog open={logoutConfirm} onClose={()=>setLogoutConfirm(false)} onConfirm={handleLogout}
        title="Sign Out" message="Are you sure you want to sign out?" confirmLabel="Sign Out" danger/>
    </div>
  )
}
