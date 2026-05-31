import type { StreamEnvelope, StreamEventType } from '@omnimind/types'

/**
 * A run SSE envelope as it arrives over the wire. The concrete `data` shape
 * depends on `type`; consumers narrow via the run-state reducer. This is the
 * source of truth for the lifted `parseSSEBuffer` (previously in the M4B
 * useGatewayStream hook).
 */
export type RunStreamEnvelope = StreamEnvelope<StreamEventType, unknown>

export interface ParsedSSEEvent {
  event: string
  data: string
}

/**
 * Split a raw SSE text buffer into complete events plus a trailing remainder
 * (an incomplete event block that has not yet been fully received). The caller
 * keeps `remainder` and prepends it to the next chunk.
 */
export function parseSSEBuffer(buffer: string): { events: ParsedSSEEvent[]; remainder: string } {
  const events: ParsedSSEEvent[] = []
  const blocks = buffer.split('\n\n')
  const remainder = blocks.pop() ?? ''

  for (const block of blocks) {
    if (!block.trim()) continue
    let event = ''
    let data = ''
    for (const line of block.split('\n')) {
      if (line.startsWith('event: ')) event = line.slice(7)
      else if (line.startsWith('data: ')) data = line.slice(6)
    }
    if (event || data) events.push({ event, data })
  }

  return { events, remainder }
}

/**
 * Read an SSE `Response` body and yield decoded + JSON-parsed run envelopes.
 *
 * - Uses `response.body.getReader()` (NOT EventSource) so the caller can attach
 *   an `Authorization: Bearer <token>` header to the underlying fetch.
 * - Unparseable data blocks are skipped (defensive against partial/garbage).
 * - Stops cleanly when the body ends or `signal` aborts; releases the reader.
 */
export async function* readRunEventStream(
  response: Response,
  signal?: AbortSignal,
): AsyncGenerator<RunStreamEnvelope> {
  const reader = response.body?.getReader()
  if (!reader) return

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      if (signal?.aborted) break

      let chunk: ReadableStreamReadResult<Uint8Array>
      try {
        chunk = await reader.read()
      } catch {
        // A mid-read abort rejects with AbortError; treat any read error as
        // end-of-stream and let the caller decide whether to reconnect.
        break
      }
      if (chunk.done) break

      buffer += decoder.decode(chunk.value, { stream: true })
      const { events, remainder } = parseSSEBuffer(buffer)
      buffer = remainder

      for (const sse of events) {
        if (!sse.data) continue
        let env: RunStreamEnvelope
        try {
          env = JSON.parse(sse.data) as RunStreamEnvelope
        } catch {
          continue
        }
        yield env
      }
    }
  } finally {
    try {
      await reader.cancel()
    } catch {
      // reader already released / stream already closed
    }
  }
}
