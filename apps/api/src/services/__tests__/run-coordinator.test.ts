import { describe, it, expect, vi } from 'vitest'
import { RunCoordinator } from '../run-coordinator.js'
import type { AnyStreamEnvelope } from '../run-coordinator.js'

function env(type: string, sequence: number): AnyStreamEnvelope {
  return { type, runId: 'run-1', sequence, timestamp: 't', data: {} }
}

describe('RunCoordinator', () => {
  it('delivers published envelopes to subscribers of the same run', () => {
    const coord = new RunCoordinator()
    const received: AnyStreamEnvelope[] = []
    coord.subscribe('run-1', (e) => received.push(e))

    coord.publish('run-1', env('model.delta', 1))
    coord.publish('run-1', env('run.completed', 2))

    expect(received.map((e) => e.type)).toEqual(['model.delta', 'run.completed'])
  })

  it('does not deliver across run ids', () => {
    const coord = new RunCoordinator()
    const a: AnyStreamEnvelope[] = []
    coord.subscribe('run-1', (e) => a.push(e))
    coord.publish('run-2', env('model.delta', 1))
    expect(a).toHaveLength(0)
  })

  it('stops delivery after unsubscribe', () => {
    const coord = new RunCoordinator()
    const listener = vi.fn()
    const unsub = coord.subscribe('run-1', listener)
    coord.publish('run-1', env('model.delta', 1))
    unsub()
    coord.publish('run-1', env('model.delta', 2))
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('registers an AbortController and aborts it on cancel', () => {
    const coord = new RunCoordinator()
    const controller = coord.registerRun('run-1')
    expect(coord.isActive('run-1')).toBe(true)
    expect(controller.signal.aborted).toBe(false)

    expect(coord.abort('run-1')).toBe(true)
    expect(controller.signal.aborted).toBe(true)
  })

  it('abort returns false for an unknown/inactive run', () => {
    const coord = new RunCoordinator()
    expect(coord.abort('missing')).toBe(false)
  })

  it('finish removes the run from the active registry', () => {
    const coord = new RunCoordinator()
    coord.registerRun('run-1')
    coord.finish('run-1')
    expect(coord.isActive('run-1')).toBe(false)
    expect(coord.abort('run-1')).toBe(false)
  })
})
