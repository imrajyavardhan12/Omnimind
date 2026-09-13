'use client'

import { CheckCircle2, Crown, Loader2, Sparkles } from 'lucide-react'
import { ChatMarkdown } from '@/features/chat/components/ChatMarkdown'
import { cn } from '@/lib/utils'

/**
 * Stage 3: chairman synthesis. Text arrives live via `council.synthesis.delta`
 * and is confirmed by GET detail on completion (identical content) — the same
 * supersede contract as chat buffers, resolved inside the hook's detail merge.
 */
export function CouncilSynthesisPanel({
  text,
  done,
  chairmanName,
  isActive,
}: {
  text: string
  done: boolean
  chairmanName: string
  isActive: boolean
}) {
  const isComplete = done && text.length > 0

  return (
    <section className={cn('rounded-xl border overflow-hidden', isActive ? 'border-primary/50 bg-primary/5' : 'border-border bg-background')}>
      <header className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border">
        <div className="flex items-center gap-3">
          <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
            isComplete ? 'bg-green-500 text-white' : isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
            {isComplete ? <CheckCircle2 className="w-4 h-4" /> : '3'}
          </div>
          <div>
            <h3 className="font-semibold">Stage 3: Final Synthesis</h3>
            <p className="text-xs text-muted-foreground">Chairman synthesizes the council&apos;s wisdom</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full">
          <Crown className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-primary">{chairmanName}</span>
        </div>
      </header>

      <div className="p-6 min-h-[200px]">
        {!isActive && !isComplete ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Waiting for peer review to complete…</p>
            </div>
          </div>
        ) : !isComplete ? (
          <div>
            {text ? (
              <ChatMarkdown content={text} />
            ) : (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <div className="relative">
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    <Crown className="w-5 h-5 text-primary absolute -top-1 -right-1" />
                  </div>
                  <p className="text-sm text-muted-foreground">Chairman is synthesizing the final answer…</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2 mb-4 pb-4 border-b border-border">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-primary">Council&apos;s Final Answer</span>
              </div>
            </div>
            <ChatMarkdown content={text} />
          </div>
        )}
      </div>
    </section>
  )
}
