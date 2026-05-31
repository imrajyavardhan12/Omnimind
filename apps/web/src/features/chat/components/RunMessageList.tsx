'use client'

import { MarkdownRenderer } from '@/components/chat/MarkdownRenderer'
import type { MessageDto } from '@/features/conversations/api/conversationsApi'
import { cn } from '@/lib/utils'

/**
 * Renders server-canonical conversation history (user + assistant messages
 * loaded from the API). The live in-flight run is rendered separately by
 * RunChatView; once a streamed response is persisted it appears here and the
 * transient panel is hidden (no double render).
 */
export function RunMessageList({ messages }: { messages: MessageDto[] }) {
  return (
    <div className="space-y-4">
      {messages.map((message) => (
        <div key={message.id} className="flex justify-center px-4">
          <div
            className={cn(
              'w-full max-w-3xl rounded-2xl border p-4',
              message.role === 'user' ? 'border-border/50 bg-muted/30' : 'border-border/30 bg-background',
            )}
          >
            {message.role === 'assistant' && message.model && (
              <div className="mb-1 text-xs text-muted-foreground">
                {message.model}
                {message.provider ? ` (${message.provider})` : ''}
              </div>
            )}
            {message.role === 'user' ? (
              <div className="whitespace-pre-wrap leading-relaxed text-foreground">{message.contentText}</div>
            ) : (
              <MarkdownRenderer content={message.contentText} />
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
