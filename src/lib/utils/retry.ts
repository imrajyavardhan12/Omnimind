import { logger } from './logger'

export interface RetryOptions {
  maxRetries: number
  initialDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
  jitterMs: number
}

export interface RetryState {
  attempt: number
  maxAttempts: number
  isRetrying: boolean
  error?: string
}

export type RetryCallback = (state: RetryState) => void

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  jitterMs: 500,
}

export class RetryableError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly isRetryable: boolean = true
  ) {
    super(message)
    this.name = 'RetryableError'
  }
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof RetryableError) {
    return error.isRetryable
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    
    if (
      message.includes('timeout') ||
      message.includes('network') ||
      message.includes('econnreset') ||
      message.includes('econnrefused') ||
      message.includes('socket hang up') ||
      message.includes('fetch failed')
    ) {
      return true
    }
    
    if (message.includes('bad request') ||
        message.includes('unauthorized') ||
        message.includes('forbidden') ||
        message.includes('not found') ||
        message.includes('invalid api key') ||
        message.includes('content filtered')) {
      return false
    }
  }

  return false
}

export function isRetryableStatusCode(statusCode: number): boolean {
  return (
    statusCode === 429 || // Rate limit
    statusCode === 500 || // Internal server error
    statusCode === 502 || // Bad gateway
    statusCode === 503 || // Service unavailable
    statusCode === 504    // Gateway timeout
  )
}

function calculateDelay(attempt: number, options: RetryOptions): number {
  const exponentialDelay = options.initialDelayMs * Math.pow(options.backoffMultiplier, attempt - 1)
  const cappedDelay = Math.min(exponentialDelay, options.maxDelayMs)
  const jitter = Math.random() * options.jitterMs
  return cappedDelay + jitter
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {},
  onRetry?: RetryCallback,
  signal?: AbortSignal
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options }
  let lastError: Error | undefined

  for (let attempt = 1; attempt <= opts.maxRetries + 1; attempt++) {
    if (signal?.aborted) {
      throw new Error('Operation aborted')
    }

    try {
      return await operation()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (signal?.aborted) {
        throw new Error('Operation aborted')
      }

      const isLastAttempt = attempt > opts.maxRetries
      const shouldRetry = !isLastAttempt && isRetryableError(error)

      if (!shouldRetry) {
        logger.debug(`Retry: Not retrying - ${isLastAttempt ? 'max attempts reached' : 'non-retryable error'}`, {
          attempt,
          error: lastError.message
        })
        throw lastError
      }

      const delay = calculateDelay(attempt, opts)
      
      logger.info(`Retry: Attempt ${attempt}/${opts.maxRetries + 1} failed, retrying in ${Math.round(delay)}ms`, {
        error: lastError.message
      })

      onRetry?.({
        attempt,
        maxAttempts: opts.maxRetries + 1,
        isRetrying: true,
        error: lastError.message
      })

      await sleep(delay)
    }
  }

  throw lastError || new Error('Retry failed with unknown error')
}

export async function* withRetryStream<T>(
  createStream: () => AsyncGenerator<T>,
  options: Partial<RetryOptions> = {},
  onRetry?: RetryCallback,
  signal?: AbortSignal
): AsyncGenerator<T | { __retryStatus: RetryState }> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options }
  let lastError: Error | undefined

  for (let attempt = 1; attempt <= opts.maxRetries + 1; attempt++) {
    if (signal?.aborted) {
      throw new Error('Operation aborted')
    }

    try {
      const stream = createStream()
      
      for await (const chunk of stream) {
        if (signal?.aborted) {
          return
        }
        yield chunk
      }
      
      return
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (signal?.aborted) {
        return
      }

      const isLastAttempt = attempt > opts.maxRetries
      const shouldRetry = !isLastAttempt && isRetryableError(error)

      if (!shouldRetry) {
        logger.debug(`Retry stream: Not retrying - ${isLastAttempt ? 'max attempts reached' : 'non-retryable error'}`)
        throw lastError
      }

      const delay = calculateDelay(attempt, opts)
      
      logger.info(`Retry stream: Attempt ${attempt}/${opts.maxRetries + 1} failed, retrying in ${Math.round(delay)}ms`)

      const retryState: RetryState = {
        attempt,
        maxAttempts: opts.maxRetries + 1,
        isRetrying: true,
        error: lastError.message
      }

      onRetry?.(retryState)
      yield { __retryStatus: retryState }

      await sleep(delay)
    }
  }

  throw lastError || new Error('Retry failed with unknown error')
}

export function createRetryableResponse(response: Response): void {
  if (!response.ok && isRetryableStatusCode(response.status)) {
    throw new RetryableError(
      `API error: ${response.status} ${response.statusText}`,
      response.status,
      true
    )
  }
  
  if (!response.ok) {
    throw new RetryableError(
      `API error: ${response.status} ${response.statusText}`,
      response.status,
      false
    )
  }
}
