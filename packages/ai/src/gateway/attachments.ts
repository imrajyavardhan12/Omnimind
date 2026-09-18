import type { ModelMessage } from 'ai'
import type { GatewayMessage } from '@omnimind/types'
import type { NormalizedAttachment } from './types.js'

/**
 * Per-model attachment preparation (M7D, 12-file-pipeline.md "Provider
 * Preparation"). Pure functions: the orchestrator resolves attachment bytes +
 * extracted text; this module decides what each model actually receives.
 *
 * - Vision-capable model + image → native image part on the last user message.
 * - Anything else → text blocks appended to the last user message, with
 *   per-file and total budgets. Images on non-vision models become an honest
 *   marker (no OCR exists yet) instead of silent absence.
 * - Truncation is marked inline (`[…truncated — …]`) so the model — and anyone
 *   reading the transcript — can see context was cut.
 */

/** Max extracted-text chars sent per file, per model call. */
export const MAX_ATTACHMENT_CHARS_PER_FILE = 30_000
/** Max extracted-text chars across all attachments, per model call. */
export const MAX_ATTACHMENT_CHARS_TOTAL = 100_000

export interface AttachmentPrep {
  vision: boolean
}

export function prepareModelMessages(
  base: GatewayMessage[],
  attachments: NormalizedAttachment[],
  prep: AttachmentPrep,
): ModelMessage[] {
  if (attachments.length === 0) {
    return base.map((m) => ({ role: m.role, content: m.content })) as ModelMessage[]
  }

  // Defensive: the request contract requires >=1 message, but never drop
  // user files silently if a caller breaks that invariant.
  const withBase = base.length > 0 ? base : [{ role: 'user' as const, content: '(see attached files)' }]

  const textBlocks: string[] = []
  const imageParts: { type: 'image'; image: Uint8Array }[] = []
  let budgeted = 0

  for (const attachment of attachments) {
    if (attachment.category === 'image') {
      if (prep.vision && attachment.imageBytes) {
        imageParts.push({ type: 'image', image: attachment.imageBytes })
      } else {
        textBlocks.push(
          `[Attached image '${attachment.filename}' — this model cannot view images]`,
        )
      }
      continue
    }
    const text = attachment.text ?? ''
    if (text.length === 0) continue
    const remaining = MAX_ATTACHMENT_CHARS_TOTAL - budgeted
    if (remaining <= 0) {
      textBlocks.push(
        `[Attached file '${attachment.filename}' omitted — attachment budget exhausted]`,
      )
      continue
    }
    const allowance = Math.min(MAX_ATTACHMENT_CHARS_PER_FILE, remaining)
    const shown = text.length > allowance ? text.slice(0, allowance) : text
    const suffix =
      text.length > allowance
        ? `\n[…truncated — showing first ${allowance} of ${text.length} chars]`
        : ''
    textBlocks.push(`[Attached file '${attachment.filename}' (${attachment.mimeType})]\n${shown}${suffix}`)
    budgeted += shown.length
  }

  return withBase.map((m, index) => {
    if (index !== withBase.length - 1) {
      return { role: m.role, content: m.content } as ModelMessage
    }
    const content: ModelMessage['content'] =
      imageParts.length > 0
        ? [
            { type: 'text' as const, text: [m.content, ...textBlocks].join('\n\n') },
            ...imageParts,
          ]
        : [m.content, ...textBlocks].join('\n\n')
    return { role: m.role, content } as ModelMessage
  })
}
