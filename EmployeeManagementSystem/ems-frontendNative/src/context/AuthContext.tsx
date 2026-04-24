// src/context/AuthContext.tsx
// Mobile auth using SecureStore instead of HTTP-only cookies

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import * as SecureStore from 'expo-secure-store'
import { router } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { authAPI } from '../api'
import { TOKEN_KEY, REFRESH_KEY } from '../api/client'
import { registerForPushNotifications } from '../hooks/usePushNotifications'

interface User {
  empId: string
  name: string
  companyEmail: string
  roles: string[]
  department?: string
  gender?: string
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (companyEmail: string, password: string) => Promise<void>
  logout: () => Promise<void>
  isAuthenticated: boolean
  isAdmin: () => boolean
  isManager: () => boolean
  hasRole: (role: string) => boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User | null>(null)
  const [isLoading, setLoading] = useState(true)
  const queryClient = useQueryClient()

  // On app start — try to restore session from stored token
  useEffect(() => {
    const restore = async () => {
      try {
        const token = await SecureStore.getItemAsync(TOKEN_KEY)
        if (token) {
          const res = await authAPI.me()
          setUser(res.data)
          // Re-register push token on every app start (token can rotate)
          registerForPushNotifications()
            .then(pt => { if (pt) authAPI.savePushToken(pt).catch(() => {}) })
            .catch(() => {})
        }
      } catch {
        // Token expired or invalid — clear storage
        await SecureStore.deleteItemAsync(TOKEN_KEY)
        await SecureStore.deleteItemAsync(REFRESH_KEY)
      } finally {
        setLoading(false)
      }
    }
    restore()
  }, [])

  const login = async (username: string, password: string) => {
    queryClient.clear()
    const res = await authAPI.login({ username, password })
    const { accessToken, refreshToken } = res.data
    if (!accessToken) throw new Error('No access token in response')
    await SecureStore.setItemAsync(TOKEN_KEY, accessToken)
    if (refreshToken) await SecureStore.setItemAsync(REFRESH_KEY, refreshToken)
    const meRes = await authAPI.me()
    setUser(meRes.data)
    // Register push token after fresh login (fire-and-forget)
    registerForPushNotifications()
      .then(pt => { if (pt) authAPI.savePushToken(pt).catch(() => {}) })
      .catch(() => {})
  }

  const logout = useCallback(async () => {
    try { await authAPI.logout() } catch {}
    queryClient.clear()
    await SecureStore.deleteItemAsync(TOKEN_KEY)
    await SecureStore.deleteItemAsync(REFRESH_KEY)
    setUser(null)
    router.replace('/(auth)/login')
  }, [queryClient])

  const hasRole   = (role: string) => user?.roles?.includes(role) ?? false
  const isAdmin   = () => hasRole('ADMIN')
  const isManager = () => hasRole('MANAGER')

  return (
    <AuthContext.Provider value={{
      user, isLoading, login, logout,
      isAuthenticated: !!user,
      hasRole, isAdmin, isManager,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
