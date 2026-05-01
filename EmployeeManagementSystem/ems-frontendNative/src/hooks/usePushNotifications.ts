import { useEffect, useRef } from 'react'
import { Platform } from 'react-native'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { router } from 'expo-router'

// Remote push notifications are not available in Expo Go on Android SDK 53+
const IS_EXPO_GO = Constants.appOwnership === 'expo'

let Notifications: any = null
if (!IS_EXPO_GO) {
  try {
    Notifications = require('expo-notifications')
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge:  false,
      }),
    })
  } catch (e) {
    console.log('Push notifications not available:', e)
  }
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (IS_EXPO_GO || !Device.isDevice || !Notifications) return null

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name:             'EMS Notifications',
      importance:       Notifications.AndroidImportance.MAX,
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

  const projectId: string | undefined =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data
  return token
}

export function usePushNotifications() {
  const foregroundSub = useRef<any>(null)
  const responseSub   = useRef<any>(null)

  useEffect(() => {
    if (IS_EXPO_GO || !Notifications) return

    // Foreground: notification arrives while app is open — banner shown by OS
    foregroundSub.current = Notifications.addNotificationReceivedListener(() => {})

    // User taps a push notification (from background or killed state) → open Alerts tab
    responseSub.current = Notifications.addNotificationResponseReceivedListener(() => {
      router.push('/(app)/notifications')
    })

    return () => {
      foregroundSub.current?.remove()
      responseSub.current?.remove()
    }
  }, [])
}
