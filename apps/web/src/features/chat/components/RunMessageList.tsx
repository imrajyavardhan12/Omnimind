'use client'

import { MarkdownRenderer } from '@/components/chat/MarkdownRenderer'
import type { MessageDto } from '@/features/conversations/api/conversationsApi'
import { cn } from '@/lib/utils'

function formatCost(costUsd: string | null): string | null {
  if (costUsd === null) return null
  const n = Number(costUsd)
  if (!Number.isFinite(n)) return null
  return `$${n.toFixed(n < 0.01 ? 6 : 4)}`
}

/** Persisted usage/cost/latency footer — mirrors the live panel so it doesn't vanish on swap. */
function MessageMetaFooter({ message }: { message: MessageDto }) {
  const cost = formatCost(message.costUsd)
  if (message.totalTokens === null && cost === null && message.latencyMs === null) return null
  return (
    <div className="mt-3 flex flex-wrap gap-3 border-t border-border/30 pt-2 text-xs text-muted-foreground">
      {message.totalTokens !== null && <span>{message.totalTokens} tokens</span>}
      {cost && <span>{cost}</span>}
      {message.latencyMs !== null && <span>{(message.latencyMs / 1000).toFixed(1)}s</span>}
    </div>
  )
}

/**
 * Renders server-canonical conversation history (user + assistant messages
 * loaded from the API). The live in-flight run is rendered separately by
 * RunChatView; once a streamed response is persisted it appears here and the
 * transient panel is hidden (no double render). Assistant messages keep their
 * usage/cost/latency footer (joined from chat_model_runs) so it persists.
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
              <>
                <MarkdownRenderer content={message.contentText} />
                <MessageMetaFooter message={message} />
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
