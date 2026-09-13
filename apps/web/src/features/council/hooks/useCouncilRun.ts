'use client'

import { useCallback, useEffect, useReducer, useRef } from 'react'
import { useAuth } from '@clerk/nextjs'
import type { CouncilMember, CouncilRunStatus } from '@omnimind/types'
import { councilApi } from '../api/councilApi'
import { readRunEventStream } from '../../chat/api/sseClient'
import {
  initialCouncilState,
  isCouncilTerminal,
  loadCouncilDetail,
  reduceCouncilEvent,
  type CouncilState,
  type CouncilStreamEnvelope,
} from '../api/councilState'

const TERMINAL_EVENTS = new Set<string>([
  'council.completed',
  'council.failed',
  'council.cancelled',
])

type CouncilAction =
  | { kind: 'reset' }
  | { kind: 'creating' }
  | { kind: 'created'; runId: string; query: string; chairman: CouncilMember }
  | { kind: 'adopted'; runId: string }
  | { kind: 'event'; env: CouncilStreamEnvelope }
  | { kind: 'detail'; state: CouncilState }
  | { kind: 'fail'; code: string; message: string }

function councilReducer(state: CouncilState, action: CouncilAction): CouncilState {
  switch (action.kind) {
    case 'reset':
      return initialCouncilState
    case 'creating':
      return { ...initialCouncilState, phase: 'creating' }
    case 'created':
      return {
        ...state,
        runId: action.runId,
        query: action.query,
        chairmanProvider: action.chairman.provider,
        chairmanModel: action.chairman.model,
        phase: 'queued',
      }
    case 'adopted':
      return { ...initialCouncilState, runId: action.runId, phase: 'queued' }
    case 'event':
      return reduceCouncilEvent(state, {
        type: action.env.type,
        runId: action.env.runId,
        sequence: action.env.sequence,
        timestamp: action.env.timestamp,
        data: action.env.data,
      })
    case 'detail':
      // Server truth supersedes transient state; keep the live synthesis
      // buffer when the persisted synthesis has not landed yet.
      return {
        ...action.state,
        synthesisBuffer: action.state.synthesisBuffer || state.synthesisBuffer,
        synthesisDone: action.state.synthesisDone || state.synthesisDone,
        lastSequence: state.lastSequence,
      }
    case 'fail':
      return {
        ...state,
        phase: isCouncilTerminal(state.phase) ? state.phase : 'failed',
        error: { code: action.code, message: action.message },
      }
    default:
      return state
  }
}

export interface UseCouncilRunResult {
  state: CouncilState
  /** Create one council run and subscribe to its live event stream. */
  start: (input: { query: string; councilModels: CouncilMember[]; chairmanModel: CouncilMember }) => Promise<void>
  /** Cancel the active run (POST /cancel); the stream then reaches a terminal state. */
  cancel: () => Promise<void>
  /** Adopt an existing run id: load server truth, then attach the live stream if still active. */
  resume: (runId: string) => Promise<void>
  /** Reload server truth for the active run (refresh / reconnect path). */
  refresh: () => Promise<void>
  /** Abandon the current run state (e.g. reset button). */
  reset: () => void
  isActive: boolean
}

/**
 * Drives one council run end to end: create-then-subscribe over the live-only
 * SSE stream, per-stage status tracking in a pure reducer, and reconciliation
 * from GET detail (the durable record — stage rows, not an event log).
 *
 * No reconnect loop: council SSE has no replay (`afterSequence` is a 400), so
 * a broken stream falls back to a single authoritative GET detail instead of
 * retrying a live-only feed. Every post-await dispatch is run-token guarded.
 */
export function useCouncilRun(): UseCouncilRunResult {
  const { getToken } = useAuth()
  const [state, dispatch] = useReducer(councilReducer, initialCouncilState)

  const controllerRef = useRef<AbortController | null>(null)
  const runIdRef = useRef<string | null>(null)
  const runTokenRef = useRef(0)

  useEffect(() => {
    return () => {
      runTokenRef.current += 1
      controllerRef.current?.abort()
      controllerRef.current = null
    }
  }, [])

  const loadDetail = useCallback(
    async (runId: string, myToken: number) => {
      const token = await getToken().catch(() => null)
      if (!token || runTokenRef.current !== myToken) return
      try {
        const { run, stageResults } = await councilApi.getRun(runId, token)
        if (runTokenRef.current !== myToken) return
        dispatch({ kind: 'detail', state: loadCouncilDetail(run, stageResults) })
      } catch {
        // best effort; the stream state stands on its own
      }
    },
    [getToken],
  )

  // The stream ended WITHOUT a terminal event. Never leave a dead spinner:
  // ask the server for the authoritative status and adopt it, else surface a
  // disconnect the user can move past.
  const finalize = useCallback(
    async (runId: string, myToken: number) => {
      const token = await getToken().catch(() => null)
      if (!token || runTokenRef.current !== myToken) return
      try {
        const { run, stageResults } = await councilApi.getRun(runId, token)
        if (runTokenRef.current !== myToken) return
        dispatch({ kind: 'detail', state: loadCouncilDetail(run, stageResults) })
        if (!isCouncilTerminal(run.status)) {
          dispatch({
            kind: 'fail',
            code: 'STREAM_DISCONNECTED',
            message: 'Lost connection to the council run. It may still be deliberating — refresh to check.',
          })
        }
      } catch {
        if (runTokenRef.current !== myToken) return
        dispatch({ kind: 'fail', code: 'STREAM_DISCONNECTED', message: 'Lost connection to the council run.' })
      }
    },
    [getToken],
  )

  const consume = useCallback(
    async (runId: string, myToken: number) => {
      const controller = new AbortController()
      controllerRef.current = controller

      const authToken = await getToken().catch(() => null)
      if (!authToken) {
        dispatch({ kind: 'fail', code: 'UNAUTHENTICATED', message: 'Not authenticated' })
        return
      }

      let res: Response
      try {
        res = await councilApi.openEventStream(runId, authToken, { signal: controller.signal })
      } catch {
        if (controller.signal.aborted || runTokenRef.current !== myToken) return
        await finalize(runId, myToken)
        return
      }

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: { code?: string; message?: string } }
          | null
        dispatch({
          kind: 'fail',
          code: body?.error?.code ?? 'STREAM_ERROR',
          message: body?.error?.message ?? `Event stream returned ${res.status}`,
        })
        return
      }

      let terminal = false
      try {
        // The shared SSE reader yields chat-typed envelopes; council events
        // ride the same wire format and are narrowed by the pure reducer.
        for await (const raw of readRunEventStream(res, controller.signal)) {
          const env: CouncilStreamEnvelope = {
            type: raw.type,
            runId: raw.runId,
            sequence: raw.sequence,
            timestamp: raw.timestamp,
            data: raw.data,
          }
          if (runTokenRef.current !== myToken) return
          dispatch({ kind: 'event', env })
          if (TERMINAL_EVENTS.has(env.type)) {
            terminal = true
            break
          }
          // Stage content has no live deltas (except synthesis): pull the
          // durable rows as each stage lands so panels show text promptly.
          if (env.type === 'council.stage.completed') {
            await loadDetail(runId, myToken)
            if (runTokenRef.current !== myToken) return
          }
        }
      } catch {
        // fall through to terminal handling
      }

      if (runTokenRef.current !== myToken) return
      if (terminal) {
        await loadDetail(runId, myToken)
        return
      }
      if (controller.signal.aborted) return
      await finalize(runId, myToken)
    },
    [getToken, finalize, loadDetail],
  )

  const start = useCallback(
    async (input: { query: string; councilModels: CouncilMember[]; chairmanModel: CouncilMember }) => {
      const myToken = ++runTokenRef.current
      controllerRef.current?.abort()
      controllerRef.current = null
      dispatch({ kind: 'creating' })

      const token = await getToken().catch(() => null)
      if (!token) {
        dispatch({ kind: 'fail', code: 'UNAUTHENTICATED', message: 'Not authenticated' })
        return
      }

      let created
      try {
        created = await councilApi.createRun(input, token)
      } catch (err) {
        const apiErr = err as { code?: string; message?: string }
        dispatch({
          kind: 'fail',
          code: apiErr.code ?? 'INTERNAL_ERROR',
          message: apiErr.message ?? 'Failed to create council run',
        })
        return
      }

      if (runTokenRef.current !== myToken) return
      runIdRef.current = created.runId
      dispatch({ kind: 'created', runId: created.runId, query: input.query, chairman: input.chairmanModel })
      await consume(created.runId, myToken)
    },
    [getToken, consume],
  )

  const cancel = useCallback(async () => {
    const runId = runIdRef.current
    if (!runId) return
    try {
      const token = await getToken().catch(() => null)
      if (!token) return
      await councilApi.cancelRun(runId, token)
      // The live stream delivers council.cancelled; refresh state regardless.
      await loadDetail(runId, runTokenRef.current)
    } catch {
      // best effort; the live stream still delivers the terminal event
    }
  }, [getToken, loadDetail])

  const refresh = useCallback(async () => {
    const runId = runIdRef.current
    if (!runId) return
    await loadDetail(runId, runTokenRef.current)
  }, [loadDetail])

  const resume = useCallback(
    async (runId: string) => {
      const myToken = ++runTokenRef.current
      controllerRef.current?.abort()
      controllerRef.current = null
      runIdRef.current = runId
      dispatch({ kind: 'adopted', runId })

      const token = await getToken().catch(() => null)
      if (!token || runTokenRef.current !== myToken) return
      let status: string
      try {
        const { run, stageResults } = await councilApi.getRun(runId, token)
        if (runTokenRef.current !== myToken) return
        status = run.status
        dispatch({ kind: 'detail', state: loadCouncilDetail(run, stageResults) })
      } catch {
        if (runTokenRef.current !== myToken) return
        dispatch({ kind: 'fail', code: 'COUNCIL_RUN_NOT_FOUND', message: 'Council run not found' })
        return
      }
      if (!isCouncilTerminal(status as CouncilRunStatus)) {
        await consume(runId, myToken)
      }
    },
    [getToken, consume],
  )

  const reset = useCallback(() => {
    runTokenRef.current += 1
    controllerRef.current?.abort()
    controllerRef.current = null
    runIdRef.current = null
    dispatch({ kind: 'reset' })
  }, [])

  const isActive = state.phase === 'creating' || state.phase === 'queued' || state.phase === 'stage1' || state.phase === 'stage2' || state.phase === 'stage3'

  return { state, start, cancel, resume, refresh, reset, isActive }
}
