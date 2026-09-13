'use client'

import { useState } from 'react'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { ChatMarkdown } from '@/features/chat/components/ChatMarkdown'
import type { AnswerPanel } from '../api/councilState'
import { cn } from '@/lib/utils'

const PROVIDER_DOT: Record<string, string> = {
  openai: 'bg-green-500',
  anthropic: 'bg-orange-500',
  'google-ai-studio': 'bg-blue-500',
  gemini: 'bg-blue-500',
  openrouter: 'bg-purple-500',
}

function displayName(panel: AnswerPanel): string {
  return `${panel.provider}/${panel.model}`
}

/**
 * Stage 1: independent answers. Content arrives via GET detail (stage events
 * carry no text); live panels show status until the stage lands.
 */
export function CouncilAnswersPanel({
  answers,
  order,
  isActive,
}: {
  answers: Record<string, AnswerPanel>
  order: string[]
  isActive: boolean
}) {
  const [activeTab, setActiveTab] = useState(0)
  const panels = order.map((id) => answers[id]).filter((p) => p !== undefined)
  const done = panels.filter((p) => p.status === 'completed').length
  const hasErrors = panels.some((p) => p.status === 'failed')
  const allComplete = panels.length > 0 && panels.every((p) => p.status === 'completed')

  return (
    <section className={cn('rounded-xl border overflow-hidden', isActive ? 'border-primary/50 bg-primary/5' : 'border-border bg-background')}>
      <header className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border">
        <div className="flex items-center gap-3">
          <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
            allComplete ? 'bg-green-500 text-white' : hasErrors ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground')}>
            {allComplete ? <CheckCircle2 className="w-4 h-4" /> : hasErrors ? <AlertCircle className="w-4 h-4" /> : '1'}
          </div>
          <div>
            <h3 className="font-semibold">Stage 1: Individual Opinions</h3>
            <p className="text-xs text-muted-foreground">Each council member answers independently</p>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">{done} / {panels.length} complete</div>
      </header>

      <div className="flex border-b border-border overflow-x-auto">
        {panels.map((panel, index) => (
          <button
            key={panel.rowId}
            onClick={() => setActiveTab(index)}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap',
              activeTab === index ? 'border-primary text-foreground bg-muted/30' : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/20',
            )}
          >
            <div className={cn('w-2 h-2 rounded-full', PROVIDER_DOT[panel.provider] ?? 'bg-gray-500')} />
            <span>Response {panel.label}</span>
            {panel.status === 'running' && <Loader2 className="w-3 h-3 animate-spin" />}
            {panel.status === 'completed' && <CheckCircle2 className="w-3 h-3 text-green-500" />}
            {(panel.status === 'failed' || panel.status === 'cancelled') && <AlertCircle className="w-3 h-3 text-destructive" />}
          </button>
        ))}
      </div>

      <div className="p-4 min-h-[200px] max-h-[400px] overflow-y-auto">
        {panels[activeTab] && (
          <div key={activeTab}>
            {panels[activeTab].status === 'completed' && panels[activeTab].text ? (
              <div>
                <div className="text-xs text-muted-foreground mb-2">{displayName(panels[activeTab])}</div>
                <ChatMarkdown content={panels[activeTab].text ?? ''} />
              </div>
            ) : panels[activeTab].status === 'failed' ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3 text-center">
                  <AlertCircle className="w-8 h-8 text-destructive" />
                  <p className="text-sm text-destructive">{panels[activeTab].error?.message ?? 'Model run failed'}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">
                    {panels[activeTab].status === 'cancelled' ? 'Cancelled' : `${displayName(panels[activeTab])} is thinking…`}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
