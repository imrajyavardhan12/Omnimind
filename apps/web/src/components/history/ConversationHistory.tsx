'use client'

import { useState } from 'react'
import { MessageSquare, Trash2, Clock, DollarSign, Hash, Search, Plus } from 'lucide-react'
import { useChatStore } from '@/lib/stores/chat'
import { formatCost, formatTokens } from '@/lib/utils/tokenizer'
import { cn } from '@/lib/utils'
import { ChatSession, Message } from '@/lib/types'

interface ConversationHistoryProps {
  className?: string
}

export function ConversationHistory({ className }: ConversationHistoryProps) {
  const [searchQuery, setSearchQuery] = useState('')
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

  interface SessionStats {
    totalMessages: number
    totalTokens: number
    totalCost: number
  }

  const getSessionStats = (session: ChatSession): SessionStats => {
    const stats = session.messages.reduce(
      (acc: SessionStats, message: Message) => {
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

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Conversations</h2>
        <button
          onClick={handleNewConversation}
          className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm"
        >
          <Plus className="w-4 h-4" />
          New
        </button>
      </div>

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

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {filteredSessions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchQuery ? 'No conversations found' : 'No conversations yet'}
          </div>
        ) : (
          filteredSessions.map((session) => {
            const stats = getSessionStats(session)
            const isActive = session.id === activeSessionId
            
            return (
              <div
                key={session.id}
                className={cn(
                  'p-3 border rounded-lg cursor-pointer transition-colors group',
                  isActive 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:bg-accent'
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
                            <DollarSign className="w-3 h-3" />
                            <span>{formatCost(stats.totalCost)}</span>
                          </div>
                        </>
                      )}
                    </div>

                    {session.messages.length > 0 && (
                      <p className="text-xs text-muted-foreground truncate">
                        {session.messages[session.messages.length - 1]?.content.slice(0, 80)}...
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
                    className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {sessions.length > 0 && (
        <div className="text-xs text-muted-foreground text-center pt-2 border-t border-border">
          {sessions.length} conversation{sessions.length !== 1 ? 's' : ''} total
        </div>
      )}
    </div>
  )
}