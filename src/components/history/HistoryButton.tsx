'use client'

import { useState } from 'react'
import { History } from 'lucide-react'
import { ConversationHistory } from './ConversationHistory'
import { cn } from '@/lib/utils'

interface HistoryButtonProps {
  className?: string
}

export function HistoryButton({ className }: HistoryButtonProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className={cn('relative', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 border border-border rounded-md hover:bg-accent text-sm"
      >
        <History className="w-4 h-4" />
        History
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)} 
          />
          <div className="absolute right-0 mt-2 w-96 bg-background border border-border rounded-lg shadow-lg z-20 p-4">
            <ConversationHistory />
          </div>
        </>
      )}
    </div>
  )
}