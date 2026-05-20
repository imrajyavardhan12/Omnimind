'use client'

import { Moon, Sun } from 'lucide-react'
import { useThemeStore } from '@/lib/stores/theme'
import { motion } from 'framer-motion'

export function ThemeToggle() {
  const { resolvedTheme, toggleTheme } = useThemeStore()
  const isDark = resolvedTheme === 'dark'

  return (
    <button
      onClick={toggleTheme}
      className="relative flex items-center justify-center w-10 h-10 rounded-lg bg-accent hover:bg-accent/80 transition-colors border border-border"
      aria-label="Toggle theme"
    >
      <motion.div
        initial={false}
        animate={{
          rotate: isDark ? 0 : 180,
          scale: isDark ? 1 : 0
        }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="absolute"
      >
        <Moon className="w-5 h-5 text-foreground" />
      </motion.div>
      
      <motion.div
        initial={false}
        animate={{
          rotate: isDark ? -180 : 0,
          scale: isDark ? 0 : 1
        }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="absolute"
      >
        <Sun className="w-5 h-5 text-foreground" />
      </motion.div>
    </button>
  )
}
