/**
 * CORS allow-list for the v1 API.
 *
 * Every custom request header the browser client attaches MUST appear here, or
 * the browser's preflight (OPTIONS) blocks the request. This is exported as a
 * standalone const (rather than inlined in index.ts) so it can be asserted in a
 * unit test without importing index.ts's side effects (env parse + serve()).
 *
 * Known client headers (apps/web src/lib/api/client.ts + features/chat/api):
 *   - Content-Type        every request (JSON body)
 *   - Authorization       Clerk bearer token
 *   - Idempotency-Key     POST /v1/chat/runs (dedupe a retried submit)
 *   - x-request-id        request correlation
 *
 * The missing `Idempotency-Key` here caused run creation to fail in the browser
 * with a CORS error (M6 live click-through) — curl and mocked-fetch tests can't
 * catch it, so cors.test.ts guards it.
 */
export const CORS_ALLOW_HEADERS = [
  'Content-Type',
  'Authorization',
  'Idempotency-Key',
  'x-request-id',
] as const
