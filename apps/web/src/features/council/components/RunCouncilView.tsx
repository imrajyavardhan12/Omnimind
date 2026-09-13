'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, RotateCcw, Send, Square, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useAvailableModels } from '@/features/models/hooks/useModels'
import { useCouncilRun } from '../hooks/useCouncilRun'
import {
  MIN_COUNCIL_MODELS,
  useCouncilComposerStore,
} from '../state/councilComposerStore'
import { CouncilAnswersPanel } from './CouncilAnswersPanel'
import { CouncilModelPicker } from './CouncilModelPicker'
import { CouncilReviewsPanel } from './CouncilReviewsPanel'
import { CouncilSynthesisPanel } from './CouncilSynthesisPanel'
import { cn } from '@/lib/utils'

/**
 * The backend-run council surface (M8C): owns `useCouncilRun`, submits the
 * query + model selections once, renders stage panels from the live stream,
 * and reconciles content from GET detail. Replaces the legacy
 * `CouncilInterface` (direct provider fan-out + localStorage session).
 */
export function RunCouncilView({ className }: { className?: string }) {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const stagesRef = useRef<HTMLDivElement>(null)

  const { councilModels, chairmanModel, activeRunId, setActiveRunId } = useCouncilComposerStore()
  const { state, start, cancel, resume, reset, isActive } = useCouncilRun()
  const { models: catalogModels } = useAvailableModels({ enabledOnly: true })

  const isReady = councilModels.length >= MIN_COUNCIL_MODELS && chairmanModel !== null
  const hasRun = state.runId !== undefined || state.phase !== 'idle'

  // Persist the active run pointer while a run is live so a refresh resumes
  // the same run from GET detail (navigation state, not canonical data).
  useEffect(() => {
    if (state.runId && isActive) setActiveRunId(state.runId)
  }, [state.runId, isActive, setActiveRunId])

  // Resume the persisted pointer from the server on mount.
  useEffect(() => {
    if (activeRunId && state.phase === 'idle' && !isActive) {
      void resume(activeRunId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [input])

  useEffect(() => {
    if (stagesRef.current && hasRun) {
      stagesRef.current.scrollTo({ top: stagesRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [hasRun, state.stage, state.phase])

  const displayName = useMemo(() => {
    const byKey = new Map(catalogModels.map((m) => [`${m.provider}:${m.id}`, m.name]))
    return (provider: string, model: string) => byKey.get(`${provider}:${model}`) ?? `${provider}/${model}`
  }, [catalogModels])

  const answerNames = useMemo(() => {
    const names: Record<string, string> = {}
    for (const id of state.answerOrder) {
      const panel = state.answers[id]
      if (panel) names[panel.label] = displayName(panel.provider, panel.model)
    }
    return names
  }, [state.answers, state.answerOrder, displayName])

  const chairmanName = state.chairmanModel
    ? displayName(state.chairmanProvider ?? '', state.chairmanModel)
    : (chairmanModel?.name ?? 'Chairman')

  const handleSubmit = async () => {
    const query = input.trim()
    if (!query || !isReady || isActive || !chairmanModel) return
    setInput('')
    setActiveRunId(null)
    await start({
      query,
      councilModels: councilModels.map((m) => ({ provider: m.provider, model: m.model })),
      chairmanModel: { provider: chairmanModel.provider, model: chairmanModel.model },
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSubmit()
    }
  }

  const handleReset = () => {
    reset()
    setActiveRunId(null)
  }

  return (
    <div className={cn('relative h-full flex flex-col', className)}>
      <div className="relative z-10 border-b border-border bg-background">
        <div className="px-6 py-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
              <Users className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">LLM Council</h2>
              <p className="text-sm text-muted-foreground">
                Multiple AI models debate and synthesize the best answer
              </p>
            </div>
          </div>
          <CouncilModelPicker />
        </div>
      </div>

      <div ref={stagesRef} className="flex-1 overflow-y-auto pb-48" style={{ paddingTop: '1rem' }}>
        <div className="max-w-4xl mx-auto px-4 space-y-6">
          {!hasRun && (
            <div className="flex items-center justify-center min-h-[300px]">
              <div className="text-center space-y-4 max-w-md">
                <div className="text-6xl">🏛️</div>
                <h3 className="text-xl font-medium text-foreground">Convene the Council</h3>
                <p className="text-muted-foreground text-sm">
                  Select at least 2 AI models above, then ask a question. The council will
                  debate and synthesize the best answer.
                </p>
                {!isReady && (
                  <p className="text-amber-500 text-sm">
                    {councilModels.length < MIN_COUNCIL_MODELS
                      ? `Add ${MIN_COUNCIL_MODELS - councilModels.length} more model${councilModels.length === 1 ? '' : 's'} to start`
                      : 'Select a chairman model'}
                  </p>
                )}
              </div>
            </div>
          )}

          {hasRun && (
            <div className="space-y-6">
              {state.query && (
                <div className="p-4 bg-muted/30 rounded-lg border border-border">
                  <div className="text-xs text-muted-foreground mb-1">Question</div>
                  <div className="font-medium">{state.query}</div>
                </div>
              )}

              {state.answerOrder.length > 0 && (
                <CouncilAnswersPanel answers={state.answers} order={state.answerOrder} isActive={state.stage === 'stage1'} />
              )}

              {(state.reviewOrder.length > 0 || state.stage === 'stage2' || state.stage === 'stage3' || state.phase === 'completed') && (
                <CouncilReviewsPanel
                  reviews={state.reviews}
                  order={state.reviewOrder}
                  aggregate={state.aggregate}
                  answerNames={answerNames}
                  isActive={state.stage === 'stage2'}
                />
              )}

              {(state.stage === 'stage3' || state.phase === 'completed' || state.synthesisBuffer.length > 0 || state.synthesisDone) && (
                <CouncilSynthesisPanel
                  text={state.synthesisBuffer}
                  done={state.synthesisDone}
                  chairmanName={chairmanName}
                  isActive={state.stage === 'stage3'}
                />
              )}

              {state.phase === 'failed' && (
                <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
                  {state.error?.message ?? 'Council run failed'}
                </div>
              )}
              {state.phase === 'cancelled' && (
                <div className="p-4 bg-muted/30 border border-border rounded-lg text-muted-foreground text-sm">
                  Council run cancelled.
                </div>
              )}
            </div>
          )}

          {state.phase === 'creating' && (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Convening the council…
            </div>
          )}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-20 p-6 bg-gradient-to-t from-background via-background to-transparent">
        <div className="max-w-3xl mx-auto">
          <div className="relative bg-background border rounded-3xl p-4 shadow-lg shadow-black/10 max-w-4xl mx-auto">
            <div className="relative mb-4">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={!isReady ? 'Configure council members above to start…' : isActive ? 'Council is deliberating…' : 'Ask the council a question…'}
                disabled={!isReady || isActive}
                className="min-h-[80px] max-h-[120px] resize-none bg-transparent border-none text-foreground text-base placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:outline-none disabled:opacity-50"
              />
            </div>
            <div className="flex items-center justify-between mt-4">
              <div className="text-xs text-muted-foreground">
                {isReady ? `${councilModels.length} models • ${chairmanModel?.name} as chairman` : <span className="text-amber-500">Configure council above</span>}
              </div>
              <div className="flex items-center gap-2">
                {hasRun && (
                  <Button onClick={handleReset} variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                    Reset
                  </Button>
                )}
                <Button
                  onClick={() => void handleSubmit()}
                  size="sm"
                  disabled={!input.trim() || !isReady || isActive}
                  className="flex items-center justify-center w-9 h-9 rounded-full p-0 border-0 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isActive ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <Send className="h-4 w-4 text-white" />}
                </Button>
                <Button
                  onClick={() => void cancel()}
                  disabled={!isActive}
                  size="sm"
                  variant={isActive ? 'destructive' : 'ghost'}
                  className={cn('flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200', !isActive && 'bg-muted/50 text-muted-foreground cursor-not-allowed opacity-50')}
                >
                  <Square className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
