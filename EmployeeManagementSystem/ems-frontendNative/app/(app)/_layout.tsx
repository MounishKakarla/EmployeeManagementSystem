// app/(app)/_layout.tsx
// Bottom tab navigator — protected route wrapper
import { Tabs, Redirect } from 'expo-router'
import { useAuth } from '../../src/context/AuthContext'
import { useThemeColors } from '../../src/hooks/useThemeColors'
import { View, ActivityIndicator, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function AppLayout() {
  const { isAuthenticated, isLoading } = useAuth()
  const Colors = useThemeColors()
  const insets = useSafeAreaInsets()

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bgPrimary }}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    )
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />
  }

  // Android draws edge-to-edge in API 29+ (Android 10+) and mandatorily in API 35 (Android 15).
  // The system nav bar (gesture strip or 3-button bar) sits BELOW the drawable area.
  // insets.bottom reports that height so we can grow the tab bar to always clear it.
  const bottomInset = insets.bottom ?? 0
  const TAB_BAR_HEIGHT = 56 + bottomInset

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.bgCard,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: TAB_BAR_HEIGHT,
          // Icon + label sit in the upper 56 px; the remaining space is transparent
          // padding that fills the system nav bar region.
          paddingTop: 6,
          paddingBottom: bottomInset > 0 ? bottomInset : 8,
        },
        tabBarActiveTintColor:   Colors.accent,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: 'Attendance',
          tabBarIcon: ({ color, size }) => <Ionicons name="time-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="leave"
        options={{
          title: 'Leave',
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="timesheets"
        options={{
          title: 'Timesheets',
          tabBarIcon: ({ color, size }) => <Ionicons name="document-text-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  )
}
