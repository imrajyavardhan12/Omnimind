import { describe, it, expect } from 'vitest'
import { parseSSEBuffer, readRunEventStream, type RunStreamEnvelope } from '../sseClient'

describe('parseSSEBuffer', () => {
  it('parses a single complete event', () => {
    const input = 'event: delta\ndata: {"type":"delta","delta":"hi"}\n\n'
    const { events, remainder } = parseSSEBuffer(input)
    expect(events).toHaveLength(1)
    expect(events[0]!.event).toBe('delta')
    expect(events[0]!.data).toBe('{"type":"delta","delta":"hi"}')
    expect(remainder).toBe('')
  })

  it('parses multiple complete events', () => {
    const input =
      'event: delta\ndata: {"type":"delta","delta":"a"}\n\n' +
      'event: delta\ndata: {"type":"delta","delta":"b"}\n\n' +
      'event: done\ndata: {"type":"done"}\n\n'
    const { events, remainder } = parseSSEBuffer(input)
    expect(events).toHaveLength(3)
    expect(events[0]!.event).toBe('delta')
    expect(events[1]!.event).toBe('delta')
    expect(events[2]!.event).toBe('done')
    expect(remainder).toBe('')
  })

  it('retains incomplete trailing block as remainder', () => {
    const input = 'event: delta\ndata: {"type":"delta","delta":"a"}\n\nevent: del'
    const { events, remainder } = parseSSEBuffer(input)
    expect(events).toHaveLength(1)
    expect(remainder).toBe('event: del')
  })

  it('returns empty events for an incomplete buffer', () => {
    const input = 'event: delta\ndata: partial'
    const { events, remainder } = parseSSEBuffer(input)
    expect(events).toHaveLength(0)
    expect(remainder).toBe('event: delta\ndata: partial')
  })

  it('handles empty input', () => {
    const { events, remainder } = parseSSEBuffer('')
    expect(events).toHaveLength(0)
    expect(remainder).toBe('')
  })

  it('skips blank blocks between events', () => {
    const input = 'event: delta\ndata: {"type":"delta","delta":"x"}\n\n\n\nevent: done\ndata: {"type":"done"}\n\n'
    const { events, remainder } = parseSSEBuffer(input)
    expect(events).toHaveLength(2)
    expect(events[0]!.event).toBe('delta')
    expect(events[1]!.event).toBe('done')
  })

  it('handles error event type', () => {
    const input = 'event: error\ndata: {"type":"error","error":{"code":"MODEL_NOT_FOUND","message":"not found"}}\n\n'
    const { events, remainder } = parseSSEBuffer(input)
    expect(events).toHaveLength(1)
    expect(events[0]!.event).toBe('error')
    const data = JSON.parse(events[0]!.data)
    expect(data.error.code).toBe('MODEL_NOT_FOUND')
    expect(remainder).toBe('')
  })
})

/** Build a Response whose body streams the given UTF-8 chunks. */
function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
  return new Response(body)
}

async function collect(response: Response): Promise<RunStreamEnvelope[]> {
  const out: RunStreamEnvelope[] = []
  for await (const env of readRunEventStream(response)) out.push(env)
  return out
}

describe('readRunEventStream', () => {
  it('yields parsed envelopes across chunk boundaries', async () => {
    const events = await collect(
      sseResponse([
        'event: run.started\ndata: {"type":"run.started","runId":"r1","sequence":1,"timestamp":"t","data":{"conversationId":"c1"}}\n\n',
        'event: model.delta\ndata: {"type":"model.delta","runId":"r1","sequen', // split mid-event
        'ce":2,"timestamp":"t","data":{"modelRunId":"m1","text":"hi"}}\n\n',
        'event: run.completed\ndata: {"type":"run.completed","runId":"r1","sequence":3,"timestamp":"t","data":{}}\n\n',
      ]),
    )
    expect(events.map((e) => e.type)).toEqual(['run.started', 'model.delta', 'run.completed'])
    expect(events[1]!.sequence).toBe(2)
  })

  it('skips unparseable data blocks without throwing', async () => {
    const events = await collect(
      sseResponse([
        'event: model.delta\ndata: not-json\n\n',
        'event: run.completed\ndata: {"type":"run.completed","runId":"r1","sequence":5,"timestamp":"t","data":{}}\n\n',
      ]),
    )
    expect(events).toHaveLength(1)
    expect(events[0]!.type).toBe('run.completed')
  })

  it('returns nothing for a body-less response', async () => {
    const events = await collect(new Response(null))
    expect(events).toHaveLength(0)
  })

  it('stops yielding once the signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const out: RunStreamEnvelope[] = []
    for await (const env of readRunEventStream(
      sseResponse(['event: run.started\ndata: {"type":"run.started","runId":"r","sequence":1,"timestamp":"t","data":{}}\n\n']),
      controller.signal,
    )) {
      out.push(env)
    }
    expect(out).toHaveLength(0)
  })
})
