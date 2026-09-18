import { describe, it, expect } from 'vitest'
import {
  MAX_ATTACHMENT_CHARS_PER_FILE,
  MAX_ATTACHMENT_CHARS_TOTAL,
  prepareModelMessages,
} from '../attachments.js'
import type { NormalizedAttachment } from '../types.js'
import type { GatewayMessage } from '@omnimind/types'

const BASE: GatewayMessage[] = [
  { role: 'system', content: 'Be concise.' },
  { role: 'user', content: 'Summarize this.' },
]

function imageAttachment(over: Partial<NormalizedAttachment> = {}): NormalizedAttachment {
  return {
    fileId: 'f-img',
    filename: 'photo.png',
    mimeType: 'image/png',
    category: 'image',
    imageBytes: new Uint8Array([1, 2, 3]),
    ...over,
  }
}

function textAttachment(over: Partial<NormalizedAttachment> = {}): NormalizedAttachment {
  return {
    fileId: 'f-doc',
    filename: 'paper.pdf',
    mimeType: 'application/pdf',
    category: 'pdf',
    text: 'The quick brown fox.',
    ...over,
  }
}

describe('prepareModelMessages', () => {
  it('passes text-only history through untouched without attachments', () => {
    expect(prepareModelMessages(BASE, [], { vision: true })).toEqual([
      { role: 'system', content: 'Be concise.' },
      { role: 'user', content: 'Summarize this.' },
    ])
  })

  it('sends native image parts to vision models', () => {
    const out = prepareModelMessages(BASE, [imageAttachment()], { vision: true })
    expect(out).toHaveLength(2)
    // System message untouched.
    expect(out[0]).toEqual({ role: 'system', content: 'Be concise.' })
    const user = out[1] as { role: string; content: unknown[] }
    expect(user.role).toBe('user')
    expect(user.content).toHaveLength(2)
    expect(user.content[0]).toEqual({ type: 'text', text: 'Summarize this.' })
    expect(user.content[1]).toMatchObject({ type: 'image' })
  })

  it('marks images as unviewable for non-vision models instead of dropping them', () => {
    const out = prepareModelMessages(BASE, [imageAttachment()], { vision: false })
    expect(out).toHaveLength(2)
    const content = (out[1] as { content: string }).content
    expect(typeof content).toBe('string')
    expect(content).toContain('Summarize this.')
    expect(content).toContain("Attached image 'photo.png' — this model cannot view images")
  })

  it('appends extracted text with filename context', () => {
    const out = prepareModelMessages(BASE, [textAttachment()], { vision: false })
    const content = (out[1] as { content: string }).content
    expect(content).toContain("[Attached file 'paper.pdf' (application/pdf)]")
    expect(content).toContain('The quick brown fox.')
  })

  it('truncates per-file text with a visible marker', () => {
    const long = 'x'.repeat(MAX_ATTACHMENT_CHARS_PER_FILE + 500)
    const out = prepareModelMessages(BASE, [textAttachment({ text: long })], { vision: true })
    const content = (out[1] as { content: string }).content
    expect(content).toContain('…truncated')
    expect(content).toContain(`showing first ${MAX_ATTACHMENT_CHARS_PER_FILE} of ${long.length} chars`)
    expect(content.length).toBeLessThan(long.length + 500)
  })

  it('enforces the total budget across files and marks omissions', () => {
    // Per-file cap is 30k: four 40k files consume 30+30+30+10 = 100k, so the
    // fifth file finds zero budget left and is marked omitted, not dropped.
    const big = 'y'.repeat(40_000)
    const files = [1, 2, 3, 4].map((i) =>
      textAttachment({ fileId: `f${i}`, filename: `big${i}.txt`, text: big }),
    )
    files.push(textAttachment({ fileId: 'f5', filename: 'small.txt', text: 'small' }))
    const out = prepareModelMessages(BASE, files, { vision: true })
    const content = (out[1] as { content: string }).content
    expect(content).toContain('attachment budget exhausted')
    expect(content).toContain("'small.txt'")
  })

  it('skips empty extracted text without noise', () => {
    const out = prepareModelMessages(BASE, [textAttachment({ text: '' })], { vision: true })
    expect(out[1]).toEqual({ role: 'user', content: 'Summarize this.' })
  })

  it('never drops files when the base history is empty', () => {
    const out = prepareModelMessages([], [textAttachment()], { vision: true })
    expect(out).toHaveLength(1)
    expect(JSON.stringify(out[0])).toContain('paper.pdf')
  })
})
