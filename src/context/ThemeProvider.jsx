import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    try {
      const stored = localStorage.getItem('abs-theme')
      if (stored) return stored === 'dark'
    } catch { /* storage unavailable */ }
    return false // default to light theme
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    try { localStorage.setItem('abs-theme', isDark ? 'dark' : 'light') } catch { /* storage unavailable */ }
  }, [isDark])

  const toggle = useCallback(() => setIsDark(d => !d), [])

  return (
    <ThemeContext.Provider value={{ isDark, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be inside ThemeProvider')
  return ctx
}
