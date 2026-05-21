import type { GatewayError, GatewayErrorCode } from '@omnimind/types'

export function gatewayError(
  code: GatewayErrorCode,
  message: string,
  retryable?: boolean,
): GatewayError {
  const out: GatewayError = { code, message }
  if (retryable !== undefined) out.retryable = retryable
  return out
}

/**
 * Map an unknown error (typically from the Vercel AI SDK or the underlying
 * provider) into a typed GatewayError. Best-effort: AI SDK error shapes vary
 * across providers and SDK versions, so we sniff `name`/`statusCode`/`status`
 * rather than relying on instanceof checks that would tie us to a single SDK
 * minor version.
 */
export function mapAiSdkError(err: unknown): GatewayError {
  if (err instanceof Error && err.name === 'AbortError') {
    return gatewayError('CANCELLED', err.message || 'Request aborted')
  }

  const e = err as { name?: string; status?: number; statusCode?: number; message?: string }
  const name = e.name ?? ''
  const status = e.status ?? e.statusCode
  const message = e.message ?? 'Provider call failed'

  // Missing/empty provider key surfaces as AI_LoadAPIKeyError from
  // @ai-sdk/provider-utils. It carries no HTTP status, so without this branch
  // it would fall through to UNKNOWN_PROVIDER_ERROR — the most common BYOK
  // failure would render as opaque rather than actionable.
  if (name === 'AI_LoadAPIKeyError' || name === 'AI_LoadSettingError') {
    return gatewayError('PROVIDER_AUTH_FAILED', message, false)
  }

  if (status === 401 || status === 403) {
    return gatewayError('PROVIDER_AUTH_FAILED', message, false)
  }
  if (status === 408) {
    return gatewayError('PROVIDER_TIMEOUT', message, true)
  }
  if (status === 429) {
    return gatewayError('PROVIDER_RATE_LIMITED', message, true)
  }
  if (typeof status === 'number' && status >= 500 && status < 600) {
    return gatewayError('PROVIDER_ERROR', message, true)
  }

  if (/timeout/i.test(name) || /timeout/i.test(message)) {
    return gatewayError('PROVIDER_TIMEOUT', message, true)
  }

  return gatewayError('UNKNOWN_PROVIDER_ERROR', message)
}
