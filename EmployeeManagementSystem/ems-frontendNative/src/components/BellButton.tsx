import { View, Text, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { notificationAPI } from '../api'
import { useThemeColors } from '../hooks/useThemeColors'

export default function BellButton() {
  const router = useRouter()
  const Colors = useThemeColors()

  const { data } = useQuery({
    queryKey:        ['notif-count'],
    queryFn:         () => notificationAPI.getUnreadCount(),
    refetchInterval: 30_000,
    staleTime:       0,
  })
  const count: number = data?.data?.count ?? 0

  return (
    <TouchableOpacity
      onPress={() => router.push('/(app)/notifications')}
      style={{ padding: 4, position: 'relative' }}
      activeOpacity={0.7}
    >
      <Ionicons name="notifications-outline" size={22} color={Colors.textMuted} />
      {count > 0 && (
        <View style={{
          position:          'absolute',
          top:               0,
          right:             0,
          backgroundColor:   Colors.danger,
          borderRadius:      8,
          minWidth:          15,
          height:            15,
          paddingHorizontal: 3,
          justifyContent:    'center',
          alignItems:        'center',
        }}>
          <Text style={{ color: '#fff', fontSize: 8, fontWeight: '700', lineHeight: 15 }}>
            {count > 99 ? '99+' : String(count)}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  )
}
