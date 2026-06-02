'use client'

import { useCallback, useEffect, useReducer, useRef } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useQueryClient } from '@tanstack/react-query'
import type { ChatRunStatus, CreateRunRequest } from '@omnimind/types'
import { chatApi } from '../api/chatApi'
import { readRunEventStream, type RunStreamEnvelope } from '../api/sseClient'
import {
  applyOutputMessageIds,
  initialRunState,
  isRunTerminal,
  reduceStreamEvent,
  type RunPhase,
  type RunState,
} from '../api/runState'
import { messageKeys } from './useMessages'

const TERMINAL_EVENTS = new Set<RunStreamEnvelope['type']>([
  'run.completed',
  'run.failed',
  'run.cancelled',
])
const MAX_RECONNECTS = 2
const RECONNECT_DELAY_MS = 500

type RunAction =
  | { kind: 'reset' }
  | { kind: 'creating' }
  | { kind: 'created'; runId: string; conversationId: string }
  | { kind: 'event'; env: RunStreamEnvelope }
  | { kind: 'outputs'; map: Record<string, string> }
  | { kind: 'setPhase'; phase: RunPhase }
  | { kind: 'fail'; code: string; message: string }

function runReducer(state: RunState, action: RunAction): RunState {
  switch (action.kind) {
    case 'reset':
      return initialRunState
    case 'creating':
      return { ...initialRunState, phase: 'creating' }
    case 'created':
      return { ...state, runId: action.runId, conversationId: action.conversationId, phase: 'queued' }
    case 'event':
      return reduceStreamEvent(state, action.env)
    case 'outputs':
      return applyOutputMessageIds(state, action.map)
    case 'setPhase':
      return isRunTerminal(state.phase) ? state : { ...state, phase: action.phase }
    case 'fail':
      return {
        ...state,
        phase: isRunTerminal(state.phase) ? state.phase : 'failed',
        error: { code: action.code, message: action.message },
      }
    default:
      return state
  }
}

export interface UseChatRunResult {
  state: RunState
  /** Create one run and subscribe to its unified event stream. */
  start: (input: CreateRunRequest) => Promise<void>
  /** Cancel the active run (POST /cancel); the stream then reaches a terminal state. */
  cancel: () => Promise<void>
  /** Abandon the current run state (e.g. when switching conversations). */
  reset: () => void
  isActive: boolean
}

/**
 * Drives one chat run end to end (06-frontend-architecture.md `useChatRun`):
 * create-then-subscribe, transient per-model buffers + statuses, cancellation,
 * bounded reconnect via `?afterSequence`, and reconciliation of streamed deltas
 * with the persisted messages query on terminal.
 */
export function useChatRun(): UseChatRunResult {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const [state, dispatch] = useReducer(runReducer, initialRunState)

  const controllerRef = useRef<AbortController | null>(null)
  const runIdRef = useRef<string | null>(null)
  const conversationIdRef = useRef<string | null>(null)
  // Monotonic guard so a stale subscribe loop abandons after reset()/new start().
  const runTokenRef = useRef(0)

  // On unmount (e.g. switching single<->compare, or leaving /chat), abort the
  // open SSE reader and invalidate the run token so the consume loop exits —
  // otherwise the fetch stream leaks and keeps dispatching into a dead reducer.
  useEffect(() => {
    return () => {
      runTokenRef.current += 1
      controllerRef.current?.abort()
      controllerRef.current = null
    }
  }, [])

  const reconcile = useCallback(
    async (runId: string, conversationId: string) => {
      try {
        const token = await getToken()
        if (token) {
          const { modelRuns } = await chatApi.getRun(runId, token)
          const map: Record<string, string> = {}
          for (const mr of modelRuns) {
            if (mr.outputMessageId) map[mr.id] = mr.outputMessageId
          }
          dispatch({ kind: 'outputs', map })
        }
      } catch {
        // Mapping is best-effort; the messages refetch below is what reconciles.
      }
      await queryClient.invalidateQueries({ queryKey: messageKeys.list(conversationId) })
    },
    [getToken, queryClient],
  )

  // The stream ended WITHOUT a terminal event (orphaned run after an API
  // restart, a dropped/unpersisted terminal event, or exhausted reconnects).
  // Never leave the run stuck 'active' (spinner forever, composer blocked): ask
  // the server for the authoritative status. If it is terminal, adopt it and
  // reconcile; if it is still running server-side but we can no longer stream,
  // surface a disconnect the user can move past instead of a dead spinner.
  const finalize = useCallback(
    async (runId: string, conversationId: string, myToken: number) => {
      let serverStatus: ChatRunStatus | undefined
      try {
        const token = await getToken()
        if (token) {
          const { run, modelRuns } = await chatApi.getRun(runId, token)
          serverStatus = run.status
          const map: Record<string, string> = {}
          for (const mr of modelRuns) {
            if (mr.outputMessageId) map[mr.id] = mr.outputMessageId
          }
          dispatch({ kind: 'outputs', map })
        }
      } catch {
        // fall through to the disconnect path
      }
      // getToken + getRun take time (only reached after exhausted reconnects):
      // a new run may have started meanwhile. Don't clobber it — every other
      // post-await dispatch in this hook is guarded the same way.
      if (runTokenRef.current !== myToken) return
      if (serverStatus && isRunTerminal(serverStatus)) {
        dispatch({ kind: 'setPhase', phase: serverStatus })
      } else {
        dispatch({
          kind: 'fail',
          code: 'STREAM_DISCONNECTED',
          message: 'Lost connection to the run. It may still be processing — refresh to check.',
        })
      }
      await queryClient.invalidateQueries({ queryKey: messageKeys.list(conversationId) })
    },
    [getToken, queryClient],
  )

  const consume = useCallback(
    async (runId: string, conversationId: string, myToken: number) => {
      let afterSequence = 0
      let attempts = 0

      while (runTokenRef.current === myToken) {
        const controller = new AbortController()
        controllerRef.current = controller

        let authToken: string | null
        try {
          authToken = await getToken()
        } catch {
          authToken = null
        }
        if (!authToken) {
          dispatch({ kind: 'fail', code: 'UNAUTHENTICATED', message: 'Not authenticated' })
          return
        }

        let res: Response
        try {
          res = await chatApi.openEventStream(runId, authToken, {
            signal: controller.signal,
            ...(afterSequence > 0 && { afterSequence }),
          })
        } catch {
          if (controller.signal.aborted || runTokenRef.current !== myToken) return
          if (++attempts > MAX_RECONNECTS) {
            await finalize(runId, conversationId, myToken)
            return
          }
          await delay(RECONNECT_DELAY_MS)
          continue
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
          for await (const env of readRunEventStream(res, controller.signal)) {
            if (runTokenRef.current !== myToken) return
            dispatch({ kind: 'event', env })
            if (env.type !== 'heartbeat' && env.sequence > afterSequence) afterSequence = env.sequence
            if (TERMINAL_EVENTS.has(env.type)) {
              terminal = true
              break
            }
          }
        } catch {
          // fall through to reconnect / terminal handling
        }

        if (runTokenRef.current !== myToken) return
        if (terminal) {
          await reconcile(runId, conversationId)
          return
        }
        if (controller.signal.aborted) return // cancelled/reset elsewhere
        if (++attempts > MAX_RECONNECTS) {
          await finalize(runId, conversationId, myToken)
          return
        }
        await delay(RECONNECT_DELAY_MS)
      }
    },
    [getToken, reconcile, finalize],
  )

  const start = useCallback(
    async (input: CreateRunRequest) => {
      // Abandon any in-flight run and start a fresh one.
      const myToken = ++runTokenRef.current
      controllerRef.current?.abort()
      controllerRef.current = null
      dispatch({ kind: 'creating' })

      const idempotencyKey = crypto.randomUUID()
      let token: string | null
      try {
        token = await getToken()
      } catch {
        token = null
      }
      if (!token) {
        dispatch({ kind: 'fail', code: 'UNAUTHENTICATED', message: 'Not authenticated' })
        return
      }

      let created
      try {
        created = await chatApi.createRun(input, idempotencyKey, token)
      } catch (err) {
        const apiErr = err as { code?: string; message?: string }
        dispatch({
          kind: 'fail',
          code: apiErr.code ?? 'INTERNAL_ERROR',
          message: apiErr.message ?? 'Failed to create run',
        })
        return
      }

      if (runTokenRef.current !== myToken) return // superseded while creating
      runIdRef.current = created.runId
      conversationIdRef.current = created.conversationId
      dispatch({ kind: 'created', runId: created.runId, conversationId: created.conversationId })

      // The user message + run rows are committed by createRunSetup before the
      // POST returns, so refetch now to surface the user's prompt immediately.
      void queryClient.invalidateQueries({ queryKey: messageKeys.list(created.conversationId) })

      await consume(created.runId, created.conversationId, myToken)
    },
    [getToken, consume, queryClient],
  )

  const cancel = useCallback(async () => {
    const runId = runIdRef.current
    const conversationId = conversationIdRef.current
    if (!runId) return
    try {
      const token = await getToken()
      if (!token) return
      const { status } = await chatApi.cancelRun(runId, token)
      dispatch({ kind: 'setPhase', phase: status as ChatRunStatus })
      if (conversationId) await reconcile(runId, conversationId)
    } catch {
      // best effort; the live stream will still deliver the terminal event
    }
  }, [getToken, reconcile])

  const reset = useCallback(() => {
    runTokenRef.current += 1
    controllerRef.current?.abort()
    controllerRef.current = null
    runIdRef.current = null
    conversationIdRef.current = null
    dispatch({ kind: 'reset' })
  }, [])

  const isActive = state.phase === 'creating' || state.phase === 'queued' || state.phase === 'running'

  return { state, start, cancel, reset, isActive }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
