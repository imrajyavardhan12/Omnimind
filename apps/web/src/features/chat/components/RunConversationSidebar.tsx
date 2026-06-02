'use client'

import { useState } from 'react'
import { MessageSquare, Plus, Trash2, PanelLeft, PanelLeftClose } from 'lucide-react'
import { useConversations, useDeleteConversation } from '@/features/conversations/hooks/useConversations'
import { cn } from '@/lib/utils'

/**
 * Backend-wired conversation rail for the run view (GET /v1/conversations) —
 * list / select / new / delete. Replaces both the interim header dropdown and
 * the legacy localStorage ConversationSidebar (which never showed server
 * conversations). Owned by the run feature and rendered inside RunChatView so
 * selecting a conversation can reset in-flight run state synchronously via the
 * parent's onSelect (no cross-component race).
 */
export function RunConversationSidebar({
  activeId,
  onSelect,
  onNew,
}: {
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const { data: conversations, isLoading } = useConversations()
  const deleteConversation = useDeleteConversation()

  const items = (conversations ?? [])
    .filter((c) => c.status === 'active' && c.mode !== 'council')
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))

  const handleDelete = (id: string) => {
    deleteConversation.mutate(id)
    if (id === activeId) onNew() // dropped the open conversation — start fresh
  }

  if (collapsed) {
    return (
      <div className="flex w-12 flex-shrink-0 flex-col items-center gap-2 border-r border-border/60 bg-background py-3">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
          title="Show conversations"
        >
          <PanelLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={onNew}
          className="rounded-md bg-primary p-2 text-primary-foreground hover:bg-primary/90"
          title="New chat"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex w-72 flex-shrink-0 flex-col border-r border-border/60 bg-background">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-3">
        <button
          type="button"
          onClick={onNew}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New chat
        </button>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          title="Hide conversations"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">No conversations yet</p>
        ) : (
          <div className="space-y-0.5">
            {items.map((c) => {
              const isActive = c.id === activeId
              return (
                <div
                  key={c.id}
                  onClick={() => onSelect(c.id)}
                  className={cn(
                    'group flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm',
                    isActive ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  <MessageSquare className="h-4 w-4 flex-shrink-0 opacity-70" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate" title={c.title || 'Untitled'}>
                      {c.title || 'Untitled'}
                    </div>
                    <div className="text-xs text-muted-foreground/70">
                      {new Date(c.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(c.id)
                    }}
                    className="flex-shrink-0 p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                    title="Delete conversation"
                    aria-label={`Delete ${c.title || 'conversation'}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
