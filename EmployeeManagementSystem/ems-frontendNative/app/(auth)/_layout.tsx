// app/(auth)/_layout.tsx
// Redirect authenticated users away from login

import { Stack, Redirect } from 'expo-router'
import { useAuth } from '../../src/context/AuthContext'
import { View, ActivityIndicator } from 'react-native'
import { Colors } from '../../src/theme'

export default function AuthLayout() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bgPrimary }}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    )
  }

  if (isAuthenticated) {
    return <Redirect href="/(app)" />
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.bgPrimary } }} />
  )
}
