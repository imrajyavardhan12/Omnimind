'use client'

import { useEffect } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'
import { useThemeStore } from '@/lib/stores/theme'
import { cn } from '@/lib/utils'

interface ThemeToggleProps {
  className?: string
  showLabel?: boolean
}

export function ThemeToggle({ className, showLabel = false }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme } = useThemeStore()

  // Initialize theme on mount
  useEffect(() => {
    // Set initial theme based on stored preference or system
    const storedTheme = localStorage.getItem('omnimind-theme')
    if (storedTheme) {
      try {
        const parsed = JSON.parse(storedTheme)
        setTheme(parsed.state?.theme || 'system')
      } catch {
        setTheme('system')
      }
    } else {
      setTheme('system')
    }

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      if (useThemeStore.getState().theme === 'system') {
        setTheme('system') // This will re-resolve the theme
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [setTheme])

  const toggleTheme = () => {
    if (theme === 'light') {
      setTheme('dark')
    } else if (theme === 'dark') {
      setTheme('system')
    } else {
      setTheme('light')
    }
  }

  const getIcon = () => {
    if (theme === 'system') {
      return <Monitor className="w-4 h-4" />
    }
    return resolvedTheme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />
  }

  const getLabel = () => {
    if (theme === 'system') return 'System'
    return resolvedTheme === 'dark' ? 'Dark' : 'Light'
  }

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent transition-colors',
        className
      )}
      title={`Current theme: ${getLabel()}. Click to cycle through themes.`}
    >
      {getIcon()}
      {showLabel && (
        <span className="text-sm font-medium">
          {getLabel()}
        </span>
      )}
    </button>
  )
}