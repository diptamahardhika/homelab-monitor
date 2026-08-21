import { useState, useEffect } from 'react'

// useTheme persists the dark-mode toggle in localStorage under `theme` and
// mirrors it onto <html class="dark">. Initial value respects the saved
// preference, then the OS preference.
export function useTheme() {
  const [dark, setDark] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('theme')
    const prefersDark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
    setDark(prefersDark)
    document.documentElement.classList.toggle('dark', prefersDark)
  }, [])

  const toggleTheme = () => {
    setDark(prev => {
      const next = !prev
      document.documentElement.classList.toggle('dark', next)
      localStorage.setItem('theme', next ? 'dark' : 'light')
      return next
    })
  }

  return [dark, toggleTheme]
}
