import { useEffect, useRef } from 'react'
import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'

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

  // projectId is required since Expo SDK 46+
  const projectId: string | undefined =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data
  return token
}

/**
 * Wire up foreground + tap listeners.
 * Call this once from the root layout.
 */
export function usePushNotifications() {
  const foregroundSub = useRef<ReturnType<typeof Notifications.addNotificationReceivedListener> | null>(null)
  const responseSub   = useRef<ReturnType<typeof Notifications.addNotificationResponseReceivedListener> | null>(null)

  useEffect(() => {
    foregroundSub.current = Notifications.addNotificationReceivedListener(() => {})
    responseSub.current   = Notifications.addNotificationResponseReceivedListener(() => {})

    return () => {
      foregroundSub.current?.remove()
      responseSub.current?.remove()
    }
  }, [])
}
