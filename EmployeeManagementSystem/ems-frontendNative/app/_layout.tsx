import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import Toast, { BaseToast, ErrorToast } from 'react-native-toast-message'
import * as SplashScreen from 'expo-splash-screen'
import { AuthProvider, useAuth } from '../src/context/AuthContext'
import { ThemeProvider, useTheme } from '../src/context/ThemeContext'
import { usePushNotifications } from '../src/hooks/usePushNotifications'

const toastConfig = {
  success: (props: any) => (
    <BaseToast
      {...props}
      style={{ borderLeftColor: '#22c55e', height: undefined, minHeight: 56 }}
      text1Style={{ fontSize: 13, fontWeight: '600', flexWrap: 'wrap' }}
      text1NumberOfLines={5}
      text2NumberOfLines={5}
    />
  ),
  error: (props: any) => (
    <ErrorToast
      {...props}
      style={{ borderLeftColor: '#ef4444', height: undefined, minHeight: 56 }}
      text1Style={{ fontSize: 13, fontWeight: '600', flexWrap: 'wrap' }}
      text1NumberOfLines={5}
      text2NumberOfLines={5}
    />
  ),
}

// Prevent the native splash from auto-hiding before resources are ready
SplashScreen.preventAutoHideAsync()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 0,          // Always treat cached data as stale → refetch on mount
      refetchOnMount: true,  // Refetch whenever a component mounts
    },
  },
})

function AppContent() {
  const { isLoading: authLoading } = useAuth()
  usePushNotifications()
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
              <Toast config={toastConfig} />
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
