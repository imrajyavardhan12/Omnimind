import { describe, it, expect } from 'vitest'
import { Document, Packer, Paragraph, TextRun } from 'docx'
import {
  ExtractionError,
  extractionTypeForMime,
  extractTextBytes,
} from '../extract.js'

/** Minimal one-page PDF with a single text-showing operator (unpdf-verified). */
const MINIMAL_PDF = Buffer.from(
  `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n4 0 obj\n<< /Length 44 >>\nstream\nBT /F1 12 Tf 72 720 Td (Hello council world) Tj ET\nendstream\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n`,
  'utf8',
)

async function docxBytes(text: string): Promise<Buffer> {
  const doc = new Document({ sections: [{ children: [new Paragraph({ children: [new TextRun(text)] })] }] })
  return Packer.toBuffer(doc)
}

describe('extractionTypeForMime', () => {
  it('maps text/pdf/docx MIMEs to their extractor', () => {
    expect(extractionTypeForMime('application/pdf')).toBe('pdf_text')
    expect(
      extractionTypeForMime('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
    ).toBe('docx_text')
    expect(extractionTypeForMime('text/plain')).toBe('passthrough')
    expect(extractionTypeForMime('text/markdown')).toBe('passthrough')
    expect(extractionTypeForMime('text/csv')).toBe('passthrough')
    expect(extractionTypeForMime('application/json')).toBe('passthrough')
  })

  it('returns null for images and audio (no text extraction)', () => {
    expect(extractionTypeForMime('image/png')).toBeNull()
    expect(extractionTypeForMime('image/jpeg')).toBeNull()
    expect(extractionTypeForMime('audio/mpeg')).toBeNull()
    expect(extractionTypeForMime('application/x-msdownload')).toBeNull()
  })
})

describe('extractTextBytes', () => {
  it('passes text flavors through', async () => {
    for (const mime of ['text/plain', 'text/markdown', 'text/csv', 'application/json']) {
      const out = await extractTextBytes(mime, Buffer.from('  hello world  ', 'utf8'))
      expect(out).toEqual({ text: 'hello world', extractionType: 'passthrough' })
    }
  })

  it('rejects binaries masquerading as text', async () => {
    const binary = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
    await expect(extractTextBytes('text/plain', binary)).rejects.toBeInstanceOf(ExtractionError)
  })

  it('extracts docx text via a real round trip', async () => {
    const out = await extractTextBytes(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      await docxBytes('Docx round trip content'),
    )
    expect(out.extractionType).toBe('docx_text')
    expect(out.text).toContain('Docx round trip content')
  })

  it('extracts pdf text from a minimal fixture', async () => {
    const out = await extractTextBytes('application/pdf', MINIMAL_PDF)
    expect(out.extractionType).toBe('pdf_text')
    expect(out.text).toContain('Hello council world')
  })

  it('fails closed on corrupt PDFs', async () => {
    await expect(
      extractTextBytes('application/pdf', Buffer.from('not a pdf at all', 'utf8')),
    ).rejects.toBeInstanceOf(ExtractionError)
  })

  it('fails closed for MIMEs without an extractor', async () => {
    await expect(extractTextBytes('image/png', Buffer.from([1, 2, 3]))).rejects.toBeInstanceOf(
      ExtractionError,
    )
  })
})
