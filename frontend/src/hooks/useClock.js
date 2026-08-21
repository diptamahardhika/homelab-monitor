import { useState, useEffect } from 'react'

// useClock returns a `now` timestamp refreshed every `intervalMs` so relative
// times re-render without touching the rest of the tree.
export function useClock(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  return now
}
