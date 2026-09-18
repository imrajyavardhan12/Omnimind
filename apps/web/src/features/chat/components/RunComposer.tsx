'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Loader2, Paperclip, X } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { FILE_PICKER_ACCEPT, type StagedFile } from '@/features/files/hooks/useFileUpload'
import { cn } from '@/lib/utils'

interface RunComposerProps {
  /** May reject — the draft is preserved and the parent surfaces the error. */
  onSubmit: (text: string) => void | Promise<void>
  onCancel: () => void
  isActive: boolean
  /** True when no model is selected (cannot submit). */
  disabled: boolean
  placeholder?: string
  /** Staged uploads owned by the parent (upload-before-send). */
  stagedFiles?: StagedFile[]
  onStageFiles?: (files: File[]) => void
  onRemoveStaged?: (key: string) => void
}

export function RunComposer({
  onSubmit,
  onCancel,
  isActive,
  disabled,
  placeholder,
  stagedFiles = [],
  onStageFiles,
  onRemoveStaged,
}: RunComposerProps) {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploading = stagedFiles.some((s) => s.status === 'uploading')

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [input])

  const submit = async () => {
    const text = input.trim()
    // While uploads are in flight their ids are not submittable — wait rather
    // than silently dropping them from the run.
    if (!text || disabled || isActive || uploading) return
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
      {stagedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1 pb-2">
          {stagedFiles.map((staged) => (
            <div
              key={staged.key}
              className={cn(
                'flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs',
                staged.status === 'failed' ? 'border-red-500/40 text-red-500' : 'border-border/60 text-muted-foreground',
              )}
              title={staged.status === 'failed' ? (staged.error ?? 'Upload failed') : staged.name}
            >
              {staged.status === 'uploading' ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Paperclip className="h-3 w-3" />
              )}
              <span className="max-w-[140px] truncate">{staged.name}</span>
              {onRemoveStaged && (
                <button
                  type="button"
                  onClick={() => onRemoveStaged(staged.key)}
                  aria-label={`Remove ${staged.name}`}
                  className="hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
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
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Enter to send · Shift+Enter for a new line
          </span>
          {onStageFiles && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={FILE_PICKER_ACCEPT}
                className="hidden"
                disabled={disabled || isActive}
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    onStageFiles(Array.from(e.target.files))
                    e.target.value = ''
                  }
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || isActive}
                aria-label="Attach files"
                title="Attach files (PDF, images, text, docs, audio)"
                className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Paperclip className="h-4 w-4" />
              </button>
            </>
          )}
          {uploading && <span className="text-xs text-muted-foreground">Uploading…</span>}
        </div>
        {isActive ? (
          <button
            type="button"
            onClick={onCancel}
            aria-label="Stop generating"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background transition hover:opacity-90 active:scale-95"
          >
            <span className="h-2.5 w-2.5 rounded-[3px] bg-background" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void submit()}
            disabled={disabled || !input.trim() || uploading}
            aria-label="Send message"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background transition hover:opacity-90 active:scale-95 disabled:bg-foreground/10 disabled:text-foreground/40 disabled:active:scale-100"
          >
            <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.5} />
          </button>
        )}
      </div>
    </div>
  )
}
