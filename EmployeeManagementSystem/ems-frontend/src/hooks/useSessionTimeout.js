import { useEffect, useRef, useCallback } from 'react'

const TIMEOUT_MS       = Number(import.meta.env.VITE_SESSION_TIMEOUT_MS) || 15 * 60 * 1000
const ACTIVITY_EVENTS  = ['mousedown','keydown','scroll','touchstart','click']

export function useSessionTimeout({ onTimeout, onWarning, enabled = true }) {
  const lastActivity = useRef(Date.now())
  const intervalRef  = useRef(null)
  const warned       = useRef(false)

  const checkTimeout = useCallback(() => {
    if (!enabled) return
    const elapsed = Date.now() - lastActivity.current
    if (elapsed >= (TIMEOUT_MS - 60000) && !warned.current) {
      warned.current = true
      onWarning?.()
    }
    if (elapsed >= TIMEOUT_MS) onTimeout?.()
  }, [enabled, onTimeout, onWarning])

  const reset = useCallback(() => {
    if (!enabled) return
    lastActivity.current = Date.now()
    warned.current = false
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    reset()
    intervalRef.current = setInterval(checkTimeout, 1000)
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, reset, { passive: true }))
    return () => {
      clearInterval(intervalRef.current)
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, reset))
    }
  }, [enabled, reset, checkTimeout])

  useEffect(() => {
    if (!enabled) return
    const onVisible = () => { if (document.visibilityState === 'visible') checkTimeout() }
    const onFocus   = () => checkTimeout()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
    }
  }, [enabled, checkTimeout])
}
