'use client'

import { useState } from 'react'
import { MessageSquare, LayoutGrid } from 'lucide-react'
import { Button } from './button'
import { useViewModeStore } from '@/lib/stores/viewMode'
import { cn } from '@/lib/utils'

interface ViewModeToggleProps {
  className?: string
}

export function ViewModeToggle({ className }: ViewModeToggleProps) {
  const { viewMode, setViewMode } = useViewModeStore()
  const [isAnimating, setIsAnimating] = useState(false)

  const handleToggle = () => {
    setIsAnimating(true)
    setViewMode(viewMode === 'single' ? 'compare' : 'single')
    setTimeout(() => setIsAnimating(false), 300)
  }

  return (
    <div className={cn("flex items-center", className)}>
      <div className="relative flex bg-muted rounded-lg p-1">
        {/* Animated background */}
        <div 
          className={cn(
            "absolute inset-1 bg-background rounded-md shadow-sm transition-transform duration-300 ease-in-out",
            viewMode === 'compare' ? "translate-x-full" : "translate-x-0",
            isAnimating && "transition-transform"
          )}
          style={{ width: 'calc(50% - 2px)' }}
        />
        
        {/* Single Mode Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => viewMode !== 'single' && handleToggle()}
          className={cn(
            "relative z-10 flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors duration-200",
            viewMode === 'single' 
              ? "text-foreground" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <MessageSquare className="w-4 h-4" />
          <span className="hidden sm:inline">Chat</span>
        </Button>

        {/* Compare Mode Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => viewMode !== 'compare' && handleToggle()}
          className={cn(
            "relative z-10 flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors duration-200",
            viewMode === 'compare' 
              ? "text-foreground" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <LayoutGrid className="w-4 h-4" />
          <span className="hidden sm:inline">Compare</span>
        </Button>
      </div>

      {/* Mode indicator text */}
      <div className="hidden lg:flex items-center ml-3 text-xs text-muted-foreground">
        {viewMode === 'single' ? (
          <span>Single model chat</span>
        ) : (
          <span>Multi-model comparison</span>
        )}
      </div>
    </div>
  )
}