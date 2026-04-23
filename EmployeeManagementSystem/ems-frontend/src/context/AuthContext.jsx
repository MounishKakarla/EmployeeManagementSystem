import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authAPI } from '../api'
import { useSessionTimeout } from '../hooks/useSessionTimeout'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user,      setUser]      = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [isWarning, setIsWarning] = useState(false)
  const queryClient = useQueryClient()

  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) { setLoading(false) }
    }, 5000)

    authAPI.me()
      .then(res => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => { clearTimeout(timer); setLoading(false) })
  }, [])

  const login = async (credentials) => {
    queryClient.clear()
    await authAPI.login(credentials)
    const res = await authAPI.me()
    setUser(res.data)
  }

  const logout = useCallback(async () => {
    try { await authAPI.logout() } catch {}
    finally {
      queryClient.clear()
      setUser(null)
      setIsWarning(false)
    }
  }, [queryClient])

  const refreshSession = useCallback(async () => {
    try {
      await authAPI.refresh()
      setIsWarning(false)
      toast.success('Session extended successfully')
    } catch {
      logout().then(() => { window.location.href = '/login' })
    }
  }, [logout])

  const handleTimeout = useCallback(() => {
    toast.error('Session expired. Please sign in again.', { duration: 5000 })
    logout().then(() => { window.location.href = '/login' })
  }, [logout])

  useSessionTimeout({
    onTimeout: handleTimeout,
    onWarning: () => setIsWarning(true),
    enabled: !!user && !isWarning,
  })

  const hasRole   = (role) => user?.roles?.includes(role) ?? false
  const isAdmin   = () => hasRole('ADMIN')
  const isManager = () => hasRole('MANAGER')

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'var(--bg-primary)' }}>
        <div className="spinner" style={{ width:28, height:28 }} />
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{
      user, login, logout, refreshSession,
      hasRole, isAdmin, isManager,
      isAuthenticated: !!user,
      isLoading: loading,
      isWarning, setIsWarning,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() { return useContext(AuthContext) }
