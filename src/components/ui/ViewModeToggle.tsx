'use client'

import { useState } from 'react'
import { MessageSquare, LayoutGrid } from 'lucide-react'
import { useViewModeStore } from '@/lib/stores/viewMode'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

interface ViewModeToggleProps {
  className?: string
}

export function ViewModeToggle({ className }: ViewModeToggleProps) {
  const { viewMode, setViewMode } = useViewModeStore()
  const [isHovered, setIsHovered] = useState(false)

  const handleToggle = (mode: 'single' | 'compare') => {
    if (viewMode !== mode) {
      setViewMode(mode)
    }
  }

  return (
    <div className={cn("flex items-center", className)}>
      <div 
        className="relative flex bg-gradient-to-r from-muted/80 to-muted/60 backdrop-blur-sm rounded-xl p-1.5 border border-border/50 shadow-lg hover:shadow-xl transition-all duration-300"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Animated background with gradient */}
        <motion.div 
          className="absolute inset-1.5 bg-gradient-to-r from-orange-500/90 to-amber-500/90 rounded-lg shadow-lg"
          animate={{
            x: viewMode === 'compare' ? '100%' : '0%',
            boxShadow: isHovered 
              ? '0 8px 32px -4px rgba(251, 146, 60, 0.4)' 
              : '0 4px 16px -2px rgba(251, 146, 60, 0.25)'
          }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 30,
            duration: 0.4
          }}
          style={{ width: 'calc(50% - 3px)' }}
        />
        
        {/* Single Mode Button */}
        <motion.button
          onClick={() => handleToggle('single')}
          className={cn(
            "relative z-10 flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 min-w-0",
            viewMode === 'single' 
              ? "text-white shadow-sm" 
              : "text-muted-foreground hover:text-foreground"
          )}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <motion.div
            animate={{ 
              rotate: viewMode === 'single' ? [0, -10, 0] : 0,
              scale: viewMode === 'single' ? [1, 1.1, 1] : 1
            }}
            transition={{ duration: 0.3 }}
          >
            <MessageSquare className="w-4 h-4 flex-shrink-0" />
          </motion.div>
          <span className="hidden sm:inline font-medium">Chat</span>
        </motion.button>

        {/* Compare Mode Button */}
        <motion.button
          onClick={() => handleToggle('compare')}
          className={cn(
            "relative z-10 flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 min-w-0",
            viewMode === 'compare' 
              ? "text-white shadow-sm" 
              : "text-muted-foreground hover:text-foreground"
          )}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <motion.div
            animate={{ 
              rotate: viewMode === 'compare' ? [0, 10, 0] : 0,
              scale: viewMode === 'compare' ? [1, 1.1, 1] : 1
            }}
            transition={{ duration: 0.3 }}
          >
            <LayoutGrid className="w-4 h-4 flex-shrink-0" />
          </motion.div>
          <span className="hidden sm:inline font-medium">Compare</span>
        </motion.button>
      </div>

      {/* Enhanced mode indicator with icon */}
      <motion.div 
        className="hidden lg:flex items-center ml-4 text-xs font-medium"
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg border border-border/30">
          <div className={cn(
            "w-2 h-2 rounded-full transition-colors duration-300",
            viewMode === 'single' ? "bg-green-500" : "bg-blue-500"
          )} />
          <span className="text-muted-foreground">
            {viewMode === 'single' ? (
              "Single model chat"
            ) : (
              "Multi-model comparison"
            )}
          </span>
        </div>
      </motion.div>
    </div>
  )
}