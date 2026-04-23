// src/context/ThemeContext.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import * as SecureStore from 'expo-secure-store'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  isDark: boolean
  isReady: boolean
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  isDark: true,
  isReady: false,
  toggleTheme: () => {},
})

const STORAGE_KEY = 'ems_theme'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme,   setTheme]   = useState<Theme>('dark')
  const [isReady, setReady]   = useState(false)

  // Load saved theme on mount — mark ready once resolved so splash waits for it
  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY)
      .then(saved => {
        if (saved === 'light' || saved === 'dark') setTheme(saved as Theme)
      })
      .finally(() => setReady(true))
  }, [])

  const toggleTheme = () => {
    setTheme(prev => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark'
      SecureStore.setItemAsync(STORAGE_KEY, next)
      return next
    })
  }

  return (
    <ThemeContext.Provider value={{ theme, isDark: theme === 'dark', isReady, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
