'use client'

import { useCallback, useRef, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { apiFetchRaw } from '@/lib/api/client'
import type { GatewayError, GatewayStreamChunk, NormalizedUsage } from '@omnimind/types'

export interface GatewayStreamRequest {
  provider: string
  model: string
  messages: Array<{ role: string; content: string }>
  system?: string
  temperature?: number
  maxOutputTokens?: number
}

export interface GatewayStreamState {
  status: 'idle' | 'streaming' | 'done' | 'error'
  text: string
  usage?: NormalizedUsage
  error?: GatewayError
}

const IDLE_STATE: GatewayStreamState = { status: 'idle', text: '' }

export function parseSSEBuffer(buffer: string): { events: Array<{ event: string; data: string }>; remainder: string } {
  const events: Array<{ event: string; data: string }> = []
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

export function useGatewayStream() {
  const { getToken } = useAuth()
  const [state, setState] = useState<GatewayStreamState>(IDLE_STATE)
  const controllerRef = useRef<AbortController | null>(null)

  const start = useCallback(async (request: GatewayStreamRequest) => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    setState({ status: 'streaming', text: '' })

    const token = await getToken()
    if (!token) {
      setState({ status: 'error', text: '', error: { code: 'PROVIDER_AUTH_FAILED', message: 'Not authenticated' } })
      return
    }

    let res: Response
    try {
      res = await apiFetchRaw('/v1/chat/stream', {
        method: 'POST',
        body: JSON.stringify(request),
        signal: controller.signal,
        token,
      })
    } catch (err) {
      if (controller.signal.aborted) return
      setState({ status: 'error', text: '', error: { code: 'UNKNOWN_PROVIDER_ERROR', message: 'Network error' } })
      return
    }

    if (!res.ok) {
      const body = await res.json().catch(() => null)
      setState({
        status: 'error',
        text: '',
        error: body?.error ?? { code: 'UNKNOWN_PROVIDER_ERROR', message: `HTTP ${res.status}` },
      })
      return
    }

    const reader = res.body?.getReader()
    if (!reader) {
      setState({ status: 'error', text: '', error: { code: 'UNKNOWN_PROVIDER_ERROR', message: 'No response body' } })
      return
    }

    const decoder = new TextDecoder()
    let buffer = ''
    let accumulated = ''

    try {
      while (true) {
        if (controller.signal.aborted) break
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const { events, remainder } = parseSSEBuffer(buffer)
        buffer = remainder

        for (const sse of events) {
          let chunk: GatewayStreamChunk
          try {
            chunk = JSON.parse(sse.data)
          } catch {
            continue
          }

          if (chunk.type === 'delta') {
            accumulated += chunk.delta
            setState({ status: 'streaming', text: accumulated })
          } else if (chunk.type === 'done') {
            setState({ status: 'done', text: accumulated, usage: chunk.usage })
          } else if (chunk.type === 'error') {
            setState({ status: 'error', text: accumulated, error: chunk.error })
          }
        }
      }
    } catch (err) {
      if (controller.signal.aborted) return
      setState((prev) => ({
        status: 'error',
        text: prev.text,
        error: { code: 'UNKNOWN_PROVIDER_ERROR', message: 'Stream read error' },
      }))
    }
  }, [getToken])

  const cancel = useCallback(() => {
    controllerRef.current?.abort()
    controllerRef.current = null
    setState((prev) => ({
      ...prev,
      status: prev.status === 'streaming' ? 'error' : prev.status,
      error: prev.status === 'streaming' ? { code: 'CANCELLED', message: 'Cancelled by user' } : prev.error,
    }))
  }, [])

  return { start, cancel, state }
}
