'use client'

import { useState } from 'react'
import { GitBranch } from 'lucide-react'
import { useChatStore } from '@/lib/stores/chat'
import { Message } from '@/lib/types'
import { cn } from '@/lib/utils'

interface MessageBranchButtonProps {
  message: Message
  sessionId: string
  className?: string
}

export function MessageBranchButton({ message, sessionId, className }: MessageBranchButtonProps) {
  const [showInput, setShowInput] = useState(false)
  const [branchName, setBranchName] = useState('')
  const { createBranch } = useChatStore()
  
  const handleCreateBranch = () => {
    const name = branchName.trim() || undefined
    createBranch(sessionId, message.id, name)
    setBranchName('')
    setShowInput(false)
  }
  
  return (
    <div className={cn('relative group', className)}>
      {!showInput ? (
        <button
          onClick={() => setShowInput(true)}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-accent rounded-md text-muted-foreground hover:text-foreground"
          title="Create branch from here"
        >
          <GitBranch className="w-4 h-4" />
        </button>
      ) : (
        <div className="absolute right-0 top-0 z-10 flex items-center gap-2 bg-background border border-border rounded-md p-2 shadow-lg">
          <input
            type="text"
            placeholder="Branch name (optional)"
            value={branchName}
            onChange={(e) => setBranchName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCreateBranch()
              } else if (e.key === 'Escape') {
                setShowInput(false)
                setBranchName('')
              }
            }}
            className="w-32 px-2 py-1 text-sm border border-input rounded bg-background"
            autoFocus
          />
          <button
            onClick={handleCreateBranch}
            className="px-2 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Branch
          </button>
          <button
            onClick={() => {
              setShowInput(false)
              setBranchName('')
            }}
            className="px-2 py-1 text-sm border border-border rounded hover:bg-accent"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
