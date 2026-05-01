// app/(app)/_layout.tsx
import { Tabs, Redirect } from 'expo-router'
import { View, Text, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../../src/context/AuthContext'
import { useThemeColors } from '../../src/hooks/useThemeColors'
import { notificationAPI } from '../../src/api'

// Bell icon with a live unread-count badge
// Polls every 30 s — simple and reliable without WebSockets
function BellIcon({ color, size }: { color: string; size: number }) {
  const Colors = useThemeColors()
  const { data } = useQuery({
    queryKey:        ['notif-count'],
    queryFn:         () => notificationAPI.getUnreadCount(),
    refetchInterval: 30_000,
    staleTime:       0,
  })
  const count: number = (data?.data?.count ?? 0)

  return (
    <View style={{ width: size + 10, height: size + 10, justifyContent: 'center', alignItems: 'center' }}>
      <Ionicons name="notifications-outline" size={size} color={color} />
      {count > 0 && (
        <View style={{
          position:        'absolute',
          top:             0,
          right:           0,
          backgroundColor: Colors.danger,
          borderRadius:    8,
          minWidth:        16,
          height:          16,
          paddingHorizontal: 3,
          justifyContent:  'center',
          alignItems:      'center',
        }}>
          <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700', lineHeight: 16 }}>
            {count > 99 ? '99+' : String(count)}
          </Text>
        </View>
      )}
    </View>
  )
}

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
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color, size }) => <BellIcon color={color} size={size} />,
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
