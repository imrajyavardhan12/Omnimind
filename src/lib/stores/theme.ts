import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'light' | 'dark' | 'system'

interface ThemeState {
  theme: Theme
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      resolvedTheme: 'dark',

      setTheme: (theme: Theme) => {
        set({ theme })
        
        // Resolve the actual theme based on system preference
        const resolvedTheme = theme === 'system' 
          ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
          : theme

        set({ resolvedTheme })
        
        // Apply theme to DOM
        if (typeof window !== 'undefined') {
          const root = window.document.documentElement
          root.classList.remove('light', 'dark')
          root.classList.add(resolvedTheme)
        }
      },

      toggleTheme: () => {
        const { theme } = get()
        const newTheme = theme === 'dark' ? 'light' : 'dark'
        get().setTheme(newTheme)
      }
    }),
    {
      name: 'omnimind-theme',
      onRehydrate: (state) => {
        // Apply theme on rehydration
        if (state && typeof window !== 'undefined') {
          const resolvedTheme = state.theme === 'system' 
            ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
            : state.theme

          state.resolvedTheme = resolvedTheme
          
          const root = window.document.documentElement
          root.classList.remove('light', 'dark')
          root.classList.add(resolvedTheme)
        }
      }
    }
  )
)