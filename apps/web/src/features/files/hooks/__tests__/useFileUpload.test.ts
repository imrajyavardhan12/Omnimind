import { describe, it, expect } from 'vitest'
import { FILE_PICKER_ACCEPT, validateFileForUpload } from '../useFileUpload'

describe('validateFileForUpload', () => {
  it('accepts allowlisted types under the size cap', () => {
    expect(validateFileForUpload({ name: 'a.pdf', size: 100, type: 'application/pdf' })).toEqual({ ok: true })
    expect(validateFileForUpload({ name: 'a.png', size: 100, type: 'image/png' })).toEqual({ ok: true })
  })

  it('rejects disallowed types with the server-matching code', () => {
    const result = validateFileForUpload({ name: 'a.exe', size: 100, type: 'application/x-msdownload' })
    expect(result).toEqual({ ok: false, error: expect.objectContaining({ code: 'UNSUPPORTED_MEDIA_TYPE' }) })
  })

  it('rejects oversized files with the server-matching code', () => {
    const result = validateFileForUpload({ name: 'big.pdf', size: 26 * 1024 * 1024, type: 'application/pdf' })
    expect(result).toEqual({ ok: false, error: expect.objectContaining({ code: 'FILE_TOO_LARGE' }) })
  })

  it('derives the picker accept list from the shared allowlist', () => {
    expect(FILE_PICKER_ACCEPT).toContain('application/pdf')
    expect(FILE_PICKER_ACCEPT).toContain('image/png')
    expect(FILE_PICKER_ACCEPT).not.toContain('application/x-msdownload')
  })
})
