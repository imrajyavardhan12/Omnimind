'use client'

import { useState } from 'react'
import { 
  MessageSquare, 
  Trash2, 
  Clock, 
  DollarSign, 
  Hash, 
  Search, 
  Plus, 
  PanelLeftClose,
  PanelLeft
} from 'lucide-react'
import { useChatStore } from '@/lib/stores/chat'
import { formatCost, formatTokens } from '@/lib/utils/tokenizer'
import { useIsClient } from '@/hooks/useIsClient'
import { cn } from '@/lib/utils'

interface ConversationSidebarProps {
  className?: string
}

export function ConversationSidebar({ className }: ConversationSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const isClient = useIsClient()
  
  const { 
    sessions, 
    activeSessionId, 
    setActiveSession, 
    deleteSession, 
    createSession 
  } = useChatStore()

  const filteredSessions = sessions.filter(session =>
    session.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    session.messages.some(msg => 
      msg.content.toLowerCase().includes(searchQuery.toLowerCase())
    )
  ).sort((a, b) => b.updatedAt - a.updatedAt)

  const handleNewConversation = () => {
    const newSessionId = createSession()
    setActiveSession(newSessionId)
  }

  const getSessionStats = (session: any) => {
    const stats = session.messages.reduce(
      (acc: any, message: any) => {
        if (message.role === 'assistant' && message.provider) {
          acc.totalMessages++
          acc.totalTokens += message.tokens || 0
          acc.totalCost += message.cost || 0
        }
        return acc
      },
      { totalMessages: 0, totalTokens: 0, totalCost: 0 }
    )
    return stats
  }

  // Don't render anything on server
  if (!isClient) {
    return (
      <div className={cn('w-14 border-r border-border bg-background', className)} />
    )
  }

  // Collapsed state - show only main icons
  if (isCollapsed) {
    return (
      <div className={cn('w-14 border-r border-border bg-background flex flex-col py-4 sidebar-transition', className)}>
        <div className="flex flex-col items-center space-y-3">
          <button
            onClick={() => setIsCollapsed(false)}
            className="p-2 hover:bg-accent rounded-md transition-colors"
            title="Show conversations"
          >
            <PanelLeft className="w-5 h-5" />
          </button>
          
          <button
            onClick={handleNewConversation}
            className="p-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            title="New conversation"
          >
            <Plus className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsCollapsed(false)}
            className="p-2 hover:bg-accent rounded-md transition-colors text-muted-foreground"
            title={`View ${sessions.length} conversation${sessions.length !== 1 ? 's' : ''}`}
          >
            <MessageSquare className="w-5 h-5" />
          </button>
        </div>
      </div>
    )
  }

  // Expanded state - full sidebar
  return (
    <div className={cn('w-80 border-r border-border bg-background flex flex-col sidebar-transition', className)}>
      <div className="sidebar-content">
        {/* Header */}
        <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Conversations</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={handleNewConversation}
              className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm"
            >
              <Plus className="w-4 h-4" />
              New
            </button>
            <button
              onClick={() => setIsCollapsed(true)}
              className="p-1.5 hover:bg-accent rounded-md transition-colors"
              title="Hide sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-input rounded-md bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {filteredSessions.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            {searchQuery ? 'No conversations found' : 'No conversations yet'}
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {filteredSessions.map((session) => {
              const stats = getSessionStats(session)
              const isActive = session.id === activeSessionId
              
              return (
                <div
                  key={session.id}
                  className={cn(
                    'p-3 rounded-lg cursor-pointer transition-all duration-200 group',
                    isActive 
                      ? 'bg-primary/10 border border-primary/20 scale-[1.02]' 
                      : 'hover:bg-accent hover:scale-[1.01]'
                  )}
                  onClick={() => setActiveSession(session.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <MessageSquare className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <h3 className="font-medium text-sm truncate">
                          {session.title}
                        </h3>
                      </div>
                      
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>
                            {new Date(session.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                        
                        {stats.totalMessages > 0 && (
                          <>
                            <div className="flex items-center gap-1">
                              <Hash className="w-3 h-3" />
                              <span>{formatTokens(stats.totalTokens)}</span>
                            </div>
                            
                            <div className="flex items-center gap-1">
                              <span>{formatCost(stats.totalCost)}</span>
                            </div>
                          </>
                        )}
                      </div>

                      {session.messages.length > 0 && (
                        <p className="text-xs text-muted-foreground truncate">
                          {session.messages[session.messages.length - 1]?.content.slice(0, 60)}...
                        </p>
                      )}
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm('Delete this conversation?')) {
                          deleteSession(session.id)
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-opacity ml-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {sessions.length > 0 && (
        <div className="p-3 border-t border-border text-xs text-muted-foreground text-center">
          {sessions.length} conversation{sessions.length !== 1 ? 's' : ''} total
        </div>
      )}
      </div>
    </div>
  )
}