import { extractText as unpdfExtractText } from 'unpdf'
import mammoth from 'mammoth'

/**
 * Inline text extraction by MIME (M7C, ADR 0007: extraction runs inside
 * POST /:id/complete, no queue). Pure functions of (mime, bytes) — no R2, no
 * DB — so the whole module is unit-testable with fixtures.
 *
 * Coverage mirrors the v2 file categories (12-file-pipeline.md) minus the
 * deferred ones: images need no text (vision models take the object in M7D),
 * audio waits on transcription. `null` means "no text extraction for this
 * MIME", NOT an error — the caller decides the resulting file status.
 */

export type ExtractionKind = 'pdf_text' | 'docx_text' | 'passthrough'

export class ExtractionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ExtractionError'
  }
}

export function extractionTypeForMime(mime: string): ExtractionKind | null {
  switch (mime) {
    case 'application/pdf':
      return 'pdf_text'
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return 'docx_text'
    case 'text/plain':
    case 'text/markdown':
    case 'text/csv':
    case 'application/json':
      return 'passthrough'
    default:
      return null
  }
}

export interface ExtractedText {
  text: string
  extractionType: ExtractionKind
}

/**
 * Extract usable text from raw file bytes. Throws ExtractionError on any
 * failure (corrupt PDF, broken docx, non-UTF-8 "text") — the caller records
 * the message on the extraction row and marks the file failed. An EMPTY
 * string is a successful extraction with nothing found (e.g. scanned PDF —
 * OCR is deferred), NOT an error.
 */
export async function extractTextBytes(mime: string, bytes: Buffer): Promise<ExtractedText> {
  const kind = extractionTypeForMime(mime)
  if (kind === null) {
    throw new ExtractionError(`No text extractor for MIME type: ${mime}`)
  }
  switch (kind) {
    case 'passthrough':
      return { text: decodeUtf8Text(bytes, mime), extractionType: kind }
    case 'pdf_text':
      return { text: await extractPdfText(bytes), extractionType: kind }
    case 'docx_text':
      return { text: await extractDocxText(bytes), extractionType: kind }
  }
}

/**
 * Strict UTF-8 decode. Browser-provided MIME is never trusted alone
 * (14-security.md): a binary relabeled as text/plain must fail loudly here
 * rather than poison downstream context with replacement characters.
 */
function decodeUtf8Text(bytes: Buffer, mime: string): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).trim()
  } catch {
    throw new ExtractionError(`File with MIME ${mime} is not valid UTF-8 text`)
  }
}

async function extractPdfText(bytes: Buffer): Promise<string> {
  let text: unknown
  try {
    const out = await unpdfExtractText(new Uint8Array(bytes))
    text = (out as { text?: unknown }).text
  } catch (err) {
    throw new ExtractionError(`PDF text extraction failed: ${errorMessage(err)}`)
  }
  // unpdf versions differ (string vs string[]); normalize defensively.
  const joined = Array.isArray(text) ? text.join('\n') : typeof text === 'string' ? text : ''
  return joined.trim()
}

async function extractDocxText(bytes: Buffer): Promise<string> {
  try {
    const out = await mammoth.extractRawText({ buffer: bytes })
    return out.value.trim()
  } catch (err) {
    throw new ExtractionError(`DOCX text extraction failed: ${errorMessage(err)}`)
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'unknown error'
}
