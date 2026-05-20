'use client'

import { useEffect } from 'react'
import { useThemeStore } from '@/lib/stores/theme'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme, resolvedTheme, setTheme } = useThemeStore()

  useEffect(() => {
    // Initialize theme from store or default to dark
    const initializeTheme = () => {
      // Let the store's rehydration handle the theme
      // Just ensure it's applied to the DOM
      const currentTheme = resolvedTheme || theme || 'dark'
      document.documentElement.classList.remove('light', 'dark')
      document.documentElement.classList.add(currentTheme)
      
      // If no theme is set, set dark as default
      if (!theme) {
        setTheme('dark')
      }
    }

    initializeTheme()
  }, [theme, resolvedTheme, setTheme])

  return <>{children}</>
}