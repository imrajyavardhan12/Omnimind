'use client'

import { useEffect } from 'react'
import { useThemeStore, type Theme } from '@/lib/stores/theme'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useThemeStore()

  useEffect(() => {
    // Force dark mode only
    const initializeTheme = () => {
      document.documentElement.classList.remove('light', 'dark')
      document.documentElement.classList.add('dark')
      
      // Update store to dark mode
      setTheme('dark')
      
      // Clear any stored theme preference
      localStorage.setItem('omnimind-theme', JSON.stringify({ state: { theme: 'dark' } }))
    }

    initializeTheme()
  }, [setTheme])

  return <>{children}</>
}