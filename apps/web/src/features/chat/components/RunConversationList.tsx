'use client'

import { useState } from 'react'
import { ChevronDown, MessageSquare } from 'lucide-react'
import { useConversations } from '@/features/conversations/hooks/useConversations'
import { cn } from '@/lib/utils'

/**
 * Lists the workspace's backend conversations (GET /v1/conversations) and lets
 * the user reopen one. This replaces the legacy localStorage ConversationSidebar
 * for the run path, which never showed server-stored conversations. Selecting a
 * conversation is handled by the parent (RunChatView) so it can reset in-flight
 * run state before switching — see onSelect.
 */
export function RunConversationList({
  activeId,
  onSelect,
}: {
  activeId: string | null
  onSelect: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const { data: conversations, isLoading } = useConversations()

  const items = (conversations ?? [])
    .filter((c) => c.status === 'active' && c.mode !== 'council')
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <MessageSquare className="h-4 w-4" />
        <span className="hidden sm:inline">Conversations</span>
        <ChevronDown className="h-3.5 w-3.5" />
      </button>

      {open && (
        <>
          {/* click-away */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute left-0 z-20 mt-1 max-h-80 w-72 overflow-y-auto rounded-md border border-border bg-background p-1 shadow-lg">
            {isLoading ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">Loading…</p>
            ) : items.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">No conversations yet</p>
            ) : (
              items.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onSelect(c.id)
                    setOpen(false)
                  }}
                  className={cn(
                    'block w-full truncate rounded px-3 py-2 text-left text-sm hover:bg-accent',
                    c.id === activeId ? 'bg-accent font-medium text-foreground' : 'text-muted-foreground',
                  )}
                  title={c.title || 'Untitled'}
                >
                  {c.title || 'Untitled'}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
