import { useState, useRef, useCallback } from 'react'

// useToast owns the transient toast message: showToast(message, type) shows it
// and auto-dismisses after 3.5s, replacing any pending timer.
export function useToast() {
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3500)
  }, [])

  return { toast, showToast }
}
