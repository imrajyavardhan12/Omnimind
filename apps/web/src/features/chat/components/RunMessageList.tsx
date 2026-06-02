'use client'

import { ChatMarkdown } from './ChatMarkdown'
import type { MessageDto } from '@/features/conversations/api/conversationsApi'

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
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4">
      {messages.map((message) =>
        message.role === 'user' ? (
          <div key={message.id} className="flex justify-end">
            <div className="w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-md bg-primary/10 px-4 py-2.5 leading-relaxed text-foreground">
              {message.contentText}
            </div>
          </div>
        ) : (
          <div key={message.id} className="space-y-1.5">
            {message.model && (
              <div className="text-xs font-medium text-muted-foreground">
                {message.model}
                {message.provider && (
                  <span className="font-normal text-muted-foreground/70"> · {message.provider}</span>
                )}
              </div>
            )}
            <ChatMarkdown content={message.contentText} />
            <MessageMetaFooter message={message} />
          </div>
        ),
      )}
    </div>
  )
}
