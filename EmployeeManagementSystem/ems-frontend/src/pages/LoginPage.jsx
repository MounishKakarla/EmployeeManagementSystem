import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { Sun, Moon, AlertCircle, ArrowLeft, User, Lock } from 'lucide-react'
import useDocumentTitle from '../hooks/useDocumentTitle'
import toast from 'react-hot-toast'
import { BaseInput, BaseButton } from '../components/ui/BaseComponents'
import { parseApiError } from '../utils/errorUtils'
import '../styles/login.css'

const ROLE_INFO = [
  { role: 'ADMIN',    desc: 'Full access — create, manage, delete' },
  { role: 'MANAGER',  desc: 'View & search employees' },
  { role: 'EMPLOYEE', desc: 'Profile and self-service only' },
]

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth()
  const { theme, toggleTheme }     = useTheme()
  useDocumentTitle('Login | TekSphere')
  const navigate                   = useNavigate()
  const [loading,  setLoading]     = useState(false)
  const [apiError, setApiError]    = useState('')

  useEffect(() => { if (isAuthenticated) navigate('/dashboard') }, [isAuthenticated, navigate])

  const { register, handleSubmit, formState: { errors } } = useForm()

  const onSubmit = async (data) => {
    setLoading(true); setApiError('')
    try {
      await login({ username: data.username, password: data.password })
      toast.success('Welcome back!')
      navigate('/dashboard')
    } catch (err) {
      setApiError(parseApiError(err, 'Invalid credentials. Please try again.'))
    } finally { setLoading(false) }
  }

  return (
    <div className="login-page">
      <div className="login-left">
        <div className="login-bg-circle login-bg-circle-1" />
        <div className="login-bg-circle login-bg-circle-2" />
        <Link to="/" className="login-back-link"><ArrowLeft size={14}/> Back to home</Link>
        <div className="login-brand">
          <h1 className="login-brand-title">EMS Platform</h1>
          <p className="login-brand-desc">Centralized employee management with role-based access control and AI-powered insights.</p>
          <div className="login-checklist">
            {['Role-based access control (ADMIN / MANAGER / EMPLOYEE)',
              'Secure HttpOnly cookie authentication with auto-refresh',
              'Complete employee lifecycle management'].map((t,i) => (
              <div key={i} className="login-check-item">
                <div className="login-check-icon">
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L4 7L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="login-right">
        <button className="btn-icon login-theme-btn" onClick={toggleTheme} title="Toggle theme">
          {theme === 'dark' ? <Sun size={15}/> : <Moon size={15}/>}
        </button>
        <div className="login-form-header">
          <h2>Sign in</h2>
          <p>Use your employee ID or company email</p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="login-form">
          {apiError && (
            <div className="api-error-banner"><AlertCircle size={16}/> {apiError}</div>
          )}
          <BaseInput label="Employee ID or Email" icon={User} placeholder="TT0001 or name@tektalis.com"
            error={errors.username?.message}
            {...register('username', { required: 'Required', minLength: { value:3, message:'Min 3 chars' } })} />
          <BaseInput label="Password" icon={Lock} type="password" placeholder="Enter your password"
            error={errors.password?.message}
            {...register('password', { required: 'Password is required', minLength: { value:4, message:'Too short' } })} />
          <BaseButton type="submit" variant="primary" fullWidth loading={loading} style={{ marginTop:8, padding:'12px' }}>
            {loading ? 'Signing in…' : 'Sign In'}
          </BaseButton>
        </form>
        <div className="login-role-legend">
          <div className="login-role-legend-title">Access Levels</div>
          {ROLE_INFO.map(r => (
            <div key={r.role} className="login-role-item">
              <span className={`badge role-${r.role.toLowerCase()}`}>{r.role}</span>
              <span>{r.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
