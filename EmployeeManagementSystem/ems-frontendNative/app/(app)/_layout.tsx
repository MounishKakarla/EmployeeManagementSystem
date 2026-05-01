// app/(app)/_layout.tsx
import { Tabs, Redirect } from 'expo-router'
import { View, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../../src/context/AuthContext'
import { useThemeColors } from '../../src/hooks/useThemeColors'

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

  const bottomInset     = insets.bottom ?? 0
  const TAB_BAR_HEIGHT  = 56 + bottomInset

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.bgCard,
          borderTopColor:  Colors.border,
          borderTopWidth:  1,
          height:          TAB_BAR_HEIGHT,
          paddingTop:      6,
          paddingBottom:   bottomInset > 0 ? bottomInset : 8,
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
        name="notifications"
        options={{ href: null }}
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
