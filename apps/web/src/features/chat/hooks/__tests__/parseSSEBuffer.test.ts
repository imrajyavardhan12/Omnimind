import { describe, it, expect } from 'vitest'
import { parseSSEBuffer } from '../useGatewayStream'

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
