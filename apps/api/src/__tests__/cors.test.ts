import { describe, it, expect } from 'vitest'
import { CORS_ALLOW_HEADERS } from '../cors.js'

describe('CORS allow-list', () => {
  // Every custom header the browser client attaches must be allowed, or the
  // preflight blocks the request. Idempotency-Key was the one that regressed
  // (M6 live click-through): POST /v1/chat/runs sends it, and without it here
  // the browser CORS-blocks run creation. curl / mocked-fetch tests miss this.
  const REQUIRED_CLIENT_HEADERS = ['Content-Type', 'Authorization', 'Idempotency-Key']

  for (const header of REQUIRED_CLIENT_HEADERS) {
    it(`allows the ${header} request header`, () => {
      expect(CORS_ALLOW_HEADERS).toContain(header)
    })
  }
})
