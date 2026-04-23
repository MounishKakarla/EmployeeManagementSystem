import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import Toast from 'react-native-toast-message'
import * as SplashScreen from 'expo-splash-screen'
import { AuthProvider, useAuth } from '../src/context/AuthContext'
import { ThemeProvider, useTheme } from '../src/context/ThemeContext'

// Prevent the native splash from auto-hiding before resources are ready
SplashScreen.preventAutoHideAsync()

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

function AppContent() {
  const { isLoading: authLoading } = useAuth()
  // Wait for both auth session restore AND saved theme load before hiding splash.
  // Without this, users on light mode see a dark flash right after the splash.
  const { isReady: themeReady } = useTheme()

  const appReady = !authLoading && themeReady

  useEffect(() => {
    if (!appReady) return
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {})
    }, 300)
    return () => clearTimeout(timer)
  }, [appReady])

  if (!appReady) return null

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
    </Stack>
  )
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AuthProvider>
              <AppContent />
              <Toast />
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
