'use client'

import { useState } from 'react'
import { GitBranch, Plus, X, Check, Edit2, Trash2 } from 'lucide-react'
import { useChatStore } from '@/lib/stores/chat'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

interface BranchSelectorProps {
  sessionId: string
  className?: string
}

export function BranchSelector({ sessionId, className }: BranchSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  
  const { 
    sessions, 
    switchBranch, 
    deleteBranch, 
    renameBranch 
  } = useChatStore()
  
  const session = sessions.find(s => s.id === sessionId)
  
  // Show the selector even if there are no branches yet
  if (!session) {
    return null
  }
  
  const branches = session.branches || []
  const currentBranch = session.activeBranchId 
    ? branches.find(b => b.id === session.activeBranchId)
    : null
  
  const handleRename = (branchId: string, newName: string) => {
    if (newName.trim()) {
      renameBranch(sessionId, branchId, newName.trim())
    }
    setEditingBranchId(null)
    setEditingName('')
  }
  
  const handleDelete = (branchId: string) => {
    if (confirm('Delete this branch? This cannot be undone.')) {
      deleteBranch(sessionId, branchId)
      if (branches.length === 1) {
        setIsOpen(false)
      }
    }
  }
  
  return (
    <div className={cn('relative', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm border border-border rounded-md hover:bg-accent transition-colors"
      >
        <GitBranch className="w-4 h-4" />
        <span>{currentBranch ? currentBranch.name : 'Main'}</span>
        <span className="text-muted-foreground">
          ({branches.length + 1} {branches.length === 0 ? 'branch' : 'branches'})
        </span>
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full mt-2 left-0 w-64 bg-background border border-border rounded-lg shadow-lg z-50"
          >
            <div className="p-2">
              <div className="text-xs font-medium text-muted-foreground px-2 py-1">
                Branches
              </div>
              
              {/* Main branch */}
              <button
                onClick={() => {
                  switchBranch(sessionId, 'main')
                  setIsOpen(false)
                }}
                className={cn(
                  'w-full flex items-center justify-between px-2 py-1.5 rounded text-sm hover:bg-accent transition-colors',
                  !session.activeBranchId && 'bg-accent'
                )}
              >
                <span className="flex items-center gap-2">
                  <GitBranch className="w-3 h-3" />
                  Main
                </span>
                {!session.activeBranchId && (
                  <Check className="w-3 h-3 text-primary" />
                )}
              </button>
              
              {/* Branch list */}
              {branches.map(branch => (
                <div key={branch.id} className="group">
                  {editingBranchId === branch.id ? (
                    <div className="flex items-center gap-1 px-2 py-1.5">
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleRename(branch.id, editingName)
                          } else if (e.key === 'Escape') {
                            setEditingBranchId(null)
                          }
                        }}
                        onBlur={() => handleRename(branch.id, editingName)}
                        className="flex-1 px-1 py-0.5 text-sm bg-background border border-border rounded"
                        autoFocus
                      />
                    </div>
                  ) : (
                    <div
                      className={cn(
                        'flex items-center justify-between px-2 py-1.5 rounded text-sm hover:bg-accent transition-colors cursor-pointer',
                        session.activeBranchId === branch.id && 'bg-accent'
                      )}
                    >
                      <button
                        onClick={() => {
                          switchBranch(sessionId, branch.id)
                          setIsOpen(false)
                        }}
                        className="flex-1 flex items-center gap-2 text-left"
                      >
                        <GitBranch className="w-3 h-3" />
                        <span>{branch.name}</span>
                      </button>
                      
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingBranchId(branch.id)
                            setEditingName(branch.name)
                          }}
                          className="p-1 hover:bg-background rounded"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(branch.id)
                          }}
                          className="p-1 hover:bg-background rounded text-destructive"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      
                      {session.activeBranchId === branch.id && (
                        <Check className="w-3 h-3 text-primary ml-2" />
                      )}
                    </div>
                  )}
                </div>
              ))}
              
              {/* Help text */}
              <div className="border-t border-border mt-2 pt-2">
                <div className="text-xs text-muted-foreground px-2 py-1">
                  {branches.length === 0 
                    ? 'Hover over a message to create branches'
                    : 'Branches allow you to explore different conversation paths'}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}