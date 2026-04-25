// src/api/client.ts
// Axios instance using Bearer token from SecureStore for mobile

import axios from 'axios'
import * as SecureStore from 'expo-secure-store'
import { router } from 'expo-router'

// Set EXPO_PUBLIC_API_URL in .env to override (e.g. http://192.168.x.x:8080 for local, or your prod domain)
export const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://ems-backend-609x.onrender.com'


export const TOKEN_KEY   = 'ems_access_token'
export const REFRESH_KEY = 'ems_refresh_token'

const client = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 90000,
})

// ── Request interceptor: attach Bearer token ──────────────────────────────────
client.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── Response interceptor: auto-refresh on 401 ────────────────────────────────
let isRefreshing = false
let queue: Array<{ resolve: () => void; reject: (e: unknown) => void }> = []

client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    const skip =
      original?._retry ||
      original?.url?.includes('/auth/refresh') ||
      original?.url?.includes('/auth/login')

    if (error.response?.status === 401 && !skip) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          queue.push({
            resolve: () => resolve(client(original)),
            reject,
          })
        })
      }
      original._retry = true
      isRefreshing = true
      try {
        const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY)
        const res = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken })
        const newToken = res.data.accessToken
        await SecureStore.setItemAsync(TOKEN_KEY, newToken)
        queue.forEach(({ resolve }) => resolve())
        queue = []
        return client(original)
      } catch {
        queue.forEach(({ reject }) => reject(new Error('Session expired')))
        queue = []
        await SecureStore.deleteItemAsync(TOKEN_KEY)
        await SecureStore.deleteItemAsync(REFRESH_KEY)
        router.replace('/(auth)/login')
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject(error)
  }
)

export default client
