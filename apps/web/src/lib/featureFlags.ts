/**
 * Feature flags for the M6 frontend migration to backend runs.
 *
 * `chatRunsEnabled` routes single + compare chat through the backend run engine
 * (POST /v1/chat/runs + SSE) instead of the legacy direct-to-provider fan-out.
 * Council mode is unaffected (migrated in M8).
 *
 * Defaults ON — backend runs are the v2 path. Set NEXT_PUBLIC_CHAT_RUNS=0
 * (or "false") to fall back to the legacy fan-out while it still exists.
 */
export function chatRunsEnabled(): boolean {
  // Dot access is required so Next.js statically inlines this into the client
  // bundle — computed (bracket) access is NOT reliably replaced, which would
  // make NEXT_PUBLIC_CHAT_RUNS=0 a no-op in the browser.
  const raw = process.env.NEXT_PUBLIC_CHAT_RUNS
  if (raw === undefined || raw === '') return true
  return raw !== '0' && raw.toLowerCase() !== 'false'
}
