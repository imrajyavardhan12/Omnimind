'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Square } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'

interface RunComposerProps {
  /** May reject — the draft is preserved and the parent surfaces the error. */
  onSubmit: (text: string) => void | Promise<void>
  onCancel: () => void
  isActive: boolean
  /** True when no model is selected (cannot submit). */
  disabled: boolean
  placeholder?: string
}

export function RunComposer({ onSubmit, onCancel, isActive, disabled, placeholder }: RunComposerProps) {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [input])

  const submit = async () => {
    const text = input.trim()
    if (!text || disabled || isActive) return
    try {
      await onSubmit(text)
      setInput('') // clear only once the run was accepted; keep the draft on failure
    } catch {
      // onSubmit rejected (e.g. conversation creation failed) — preserve the draft
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void submit()
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl rounded-2xl border border-border/60 bg-background p-2.5 shadow-sm">
      <Textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={disabled ? 'Select a model to start chatting…' : (placeholder ?? 'Send a message…')}
        disabled={disabled}
        className="min-h-[64px] resize-none border-none bg-transparent text-base focus-visible:ring-0 focus-visible:outline-none disabled:opacity-50"
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Enter to send · Shift+Enter for a new line
        </span>
        {isActive ? (
          <button
            type="button"
            onClick={onCancel}
            aria-label="Stop generating"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background transition-colors hover:bg-foreground/85"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void submit()}
            disabled={disabled || !input.trim()}
            aria-label="Send message"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background transition-colors hover:bg-foreground/85 disabled:bg-muted disabled:text-muted-foreground"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  )
}
