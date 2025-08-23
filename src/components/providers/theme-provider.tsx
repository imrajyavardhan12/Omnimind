'use client'

import { useEffect } from 'react'
import { useThemeStore, type Theme } from '@/lib/stores/theme'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useThemeStore()

  useEffect(() => {
    // Initialize theme on mount
    const initializeTheme = () => {
      const stored = localStorage.getItem('omnimind-theme')
      let storedTheme = 'system'
      
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          storedTheme = parsed.state?.theme || 'system'
        } catch {
          storedTheme = 'system'
        }
      }

      // Apply theme immediately to prevent flash
      const resolvedTheme = storedTheme === 'system' 
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : storedTheme

      document.documentElement.classList.remove('light', 'dark')
      document.documentElement.classList.add(resolvedTheme)
      
      // Update store
      setTheme(storedTheme as Theme)
    }

    initializeTheme()
  }, [setTheme])

  return <>{children}</>
}