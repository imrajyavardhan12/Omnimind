import { EventEmitter } from 'node:events'
import type { StreamEnvelope } from '@omnimind/types'

export type AnyStreamEnvelope = StreamEnvelope<string, unknown>

/**
 * In-process coordination for live chat runs (single API instance only).
 *
 * Two responsibilities, deliberately kept together so routes and the
 * orchestrator share one instance:
 *  1. Pub/sub of stream envelopes keyed by runId, so GET /events subscribers
 *     receive live events while a run executes.
 *  2. An AbortController registry keyed by runId, so POST /:runId/cancel can
 *     abort the in-flight provider stream.
 *
 * This is intentionally NOT durable. Every event is also persisted to
 * chat_run_events by the orchestrator, so reconnecting or late subscribers
 * replay from the database. Redis pub/sub for multi-instance is a later
 * milestone (M9).
 */
export class RunCoordinator {
  private readonly emitter = new EventEmitter()
  private readonly controllers = new Map<string, AbortController>()

  constructor() {
    // Each concurrent SSE subscriber registers a listener for its runId; the
    // default limit of 10 is too low for popular runs. 0 disables the warning.
    this.emitter.setMaxListeners(0)
  }

  /** Create and register an AbortController for a run about to execute. */
  registerRun(runId: string): AbortController {
    const controller = new AbortController()
    this.controllers.set(runId, controller)
    return controller
  }

  /** Whether a run is currently executing in this instance. */
  isActive(runId: string): boolean {
    return this.controllers.has(runId)
  }

  /**
   * Abort an active run's provider stream. Returns true if a controller was
   * found (run is active in this instance), false otherwise.
   */
  abort(runId: string): boolean {
    const controller = this.controllers.get(runId)
    if (!controller) return false
    controller.abort()
    return true
  }

  /** Remove a run's controller once it reaches a terminal state. */
  finish(runId: string): void {
    this.controllers.delete(runId)
  }

  /** Publish a stream envelope to all live subscribers of a run. */
  publish(runId: string, envelope: AnyStreamEnvelope): void {
    this.emitter.emit(channel(runId), envelope)
  }

  /** Subscribe to a run's live envelopes. Returns an unsubscribe function. */
  subscribe(runId: string, listener: (envelope: AnyStreamEnvelope) => void): () => void {
    const ch = channel(runId)
    this.emitter.on(ch, listener)
    return () => {
      this.emitter.off(ch, listener)
    }
  }
}

function channel(runId: string): string {
  return `run:${runId}`
}
