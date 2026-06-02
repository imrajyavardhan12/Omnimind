'use client'

import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import type { CreateRunRequest } from '@omnimind/types'
import { useCreateConversation } from '@/features/conversations/hooks/useConversations'
import { useSettingsStore } from '@/lib/stores/settings'
import { cn } from '@/lib/utils'
import { computeLivePanels } from '../api/runState'
import { useChatRun } from '../hooks/useChatRun'
import { useMessages } from '../hooks/useMessages'
import { useRunComposerStore } from '../state/runComposerStore'
import { RunComposer } from './RunComposer'
import { RunConversationList } from './RunConversationList'
import { RunMessageList } from './RunMessageList'
import { RunModelPanel } from './RunModelPanel'
import { RunModelPicker } from './RunModelPicker'

const GRID_CLASS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 lg:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3',
  4: 'grid-cols-1 md:grid-cols-2',
  5: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3',
}

/**
 * The backend-runs chat experience (single + compare). Creates ONE run per
 * submit, subscribes to the unified SSE stream, renders per-model panels keyed
 * by modelRunId, and reconciles streamed deltas with persisted messages.
 */
export function RunChatView({ mode, className }: { mode: 'single' | 'compare'; className?: string }) {
  const run = useChatRun()
  const createConversation = useCreateConversation()
  const { temperature, maxTokens, messagesInContext, responseLanguage } = useSettingsStore()
  const { activeConversationId, singleModel, compareModels, setActiveConversationId } = useRunComposerStore()

  const messagesQuery = useMessages(activeConversationId ?? undefined)
  const messages = useMemo(() => messagesQuery.data ?? [], [messagesQuery.data])

  const [submitError, setSubmitError] = useState<string | null>(null)

  const selectedModels = mode === 'single' ? (singleModel ? [singleModel] : []) : compareModels

  // Live panels: model runs whose persisted assistant message is not yet in the
  // history query. Once persisted, the panel is dropped and history renders it
  // (no double render). Matched EXACTLY by modelRunId so a later turn to the same
  // model can't collide with an earlier turn's message — see computeLivePanels.
  const livePanels = useMemo(
    () => computeLivePanels(run.state.order, run.state.modelRuns, messages),
    [run.state.order, run.state.modelRuns, messages],
  )

  const handleSubmit = async (text: string) => {
    if (selectedModels.length === 0 || run.isActive) return
    setSubmitError(null)

    let conversationId = activeConversationId
    if (!conversationId) {
      try {
        const conversation = await createConversation.mutateAsync({ title: text.slice(0, 60), mode })
        conversationId = conversation.id
        setActiveConversationId(conversationId)
      } catch {
        // Surface the failure and rethrow so the composer keeps the draft.
        setSubmitError('Could not start a conversation. Please try again.')
        throw new Error('conversation-create-failed')
      }
    }

    // Honour the user's chat settings (previously dropped on the run path):
    // a non-empty response language becomes a system prompt; "messages in
    // context" (0 = all) caps history via context.messageLimit (schema max 200).
    const language = responseLanguage && responseLanguage !== 'none' ? responseLanguage.trim() : ''
    const systemPrompt = language ? `Please respond in ${language}.` : undefined

    const request: CreateRunRequest = {
      conversationId,
      input: { text },
      models: selectedModels.map((m) => ({
        provider: m.provider,
        model: m.model,
        settings: {
          temperature,
          maxOutputTokens: maxTokens,
          ...(systemPrompt ? { systemPrompt } : {}),
        },
      })),
      ...(messagesInContext > 0
        ? { context: { messageLimit: Math.min(messagesInContext, 200) } }
        : {}),
    }
    void run.start(request)
  }

  const newChat = () => {
    run.reset()
    setActiveConversationId(null)
    setSubmitError(null)
  }

  // Reopen an existing conversation: reset any in-flight run FIRST (so its panels
  // don't leak into the newly loaded history), then point at the conversation —
  // useMessages reloads it from the API.
  const selectConversation = (id: string) => {
    if (id === activeConversationId) return
    run.reset()
    setSubmitError(null)
    setActiveConversationId(id)
  }

  const showRunError =
    run.state.phase === 'failed' && run.state.error && run.state.order.length === 0

  return (
    <div className={cn('flex h-full flex-col', className)}>
      <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-border/40 px-4 py-3">
        <RunModelPicker mode={mode} />
        <div className="flex items-center gap-2">
          <RunConversationList activeId={activeConversationId} onSelect={selectConversation} />
          <button
            type="button"
            onClick={newChat}
            className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Plus className="h-4 w-4" />
            New chat
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-4">
        {messages.length === 0 && livePanels.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center">
            <div className="max-w-md space-y-2">
              <h3 className="text-xl font-medium text-foreground">How can I help you today?</h3>
              <p className="text-sm text-muted-foreground">
                {mode === 'compare'
                  ? 'Add 2–5 models, then ask once to compare responses.'
                  : 'Select a model and ask anything.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <RunMessageList messages={messages} />

            {livePanels.length > 0 && (
              <div className={cn('mx-auto grid w-full max-w-5xl gap-3 px-2', GRID_CLASS[Math.min(livePanels.length, 5)])}>
                {livePanels.map((mr) => (
                  <RunModelPanel key={mr.modelRunId} modelRun={mr} persisted={null} />
                ))}
              </div>
            )}

            {showRunError && (
              <div className="mx-auto max-w-3xl rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-500">
                {run.state.error!.code}: {run.state.error!.message}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-shrink-0 px-4 pb-4 pt-2">
        {submitError && (
          <div className="mx-auto mb-2 max-w-3xl rounded-lg border border-red-500/30 bg-red-500/5 p-2 text-sm text-red-500">
            {submitError}
          </div>
        )}
        <RunComposer
          onSubmit={handleSubmit}
          onCancel={run.cancel}
          isActive={run.isActive}
          disabled={selectedModels.length === 0}
        />
      </div>
    </div>
  )
}
