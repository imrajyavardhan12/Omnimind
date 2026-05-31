'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Send, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
    <div className="mx-auto w-full max-w-3xl rounded-2xl border border-border bg-background p-3 shadow-lg shadow-black/10">
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
        <span className="text-xs text-muted-foreground">Enter to send, Shift+Enter for a new line</span>
        <div className="flex items-center gap-2">
          {isActive && (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={onCancel}
              className="flex h-9 w-9 items-center justify-center rounded-lg p-0"
              aria-label="Stop"
            >
              <Square className="h-4 w-4" />
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            onClick={() => void submit()}
            disabled={disabled || isActive || !input.trim()}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-amber-500 p-0 text-white disabled:opacity-50"
            aria-label="Send"
          >
            {isActive ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  )
}
