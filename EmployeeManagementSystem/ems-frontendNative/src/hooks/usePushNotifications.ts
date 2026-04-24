import { useEffect, useRef } from 'react'
import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'

// Show notification banner while app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

/**
 * Request permission and return the Expo Push Token.
 * Returns null on simulators or if permission is denied.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'EMS Notifications',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    })
  }

  const { status: existing } = await Notifications.getPermissionsAsync()
  let finalStatus = existing
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }
  if (finalStatus !== 'granted') return null

  const token = (await Notifications.getExpoPushTokenAsync()).data
  return token
}

/**
 * Wire up foreground + tap listeners.
 * Call this once from the root layout.
 */
export function usePushNotifications() {
  const foregroundSub = useRef<Notifications.EventSubscription | null>(null)
  const responseSub   = useRef<Notifications.EventSubscription | null>(null)

  useEffect(() => {
    // Foreground: banner already handled by setNotificationHandler above
    foregroundSub.current = Notifications.addNotificationReceivedListener(_n => {})

    // User tapped a notification — could navigate here if needed
    responseSub.current = Notifications.addNotificationResponseReceivedListener(_r => {})

    return () => {
      foregroundSub.current?.remove()
      responseSub.current?.remove()
    }
  }, [])
}
