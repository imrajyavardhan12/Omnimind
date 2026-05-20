/**
 * Error handling utilities
 * Provides user-friendly error messages for common API errors
 */

export interface ErrorInfo {
  message: string
  isRetryable: boolean
  statusCode?: number
}

/**
 * Parse and format error messages for display to users
 */
export function parseError(error: unknown): ErrorInfo {
  // Handle fetch/network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return {
      message: 'Network error. Please check your connection and try again.',
      isRetryable: true
    }
  }

  // Handle AbortError (user cancelled)
  if (error instanceof Error && error.name === 'AbortError') {
    return {
      message: 'Request cancelled by user',
      isRetryable: false
    }
  }

  // Handle HTTP Response errors
  if (error instanceof Response) {
    return parseHttpError(error.status, error.statusText)
  }

  // Handle Error objects with status codes
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    
    // Check for status codes in message
    if (message.includes('401') || message.includes('unauthorized')) {
      return {
        message: 'Invalid API key. Please check your settings and try again.',
        isRetryable: false,
        statusCode: 401
      }
    }
    
    if (message.includes('403') || message.includes('forbidden')) {
      return {
        message: 'Access denied. Your API key may not have permission for this model.',
        isRetryable: false,
        statusCode: 403
      }
    }
    
    if (message.includes('429') || message.includes('rate limit')) {
      return {
        message: 'Rate limit exceeded. Please wait a moment before trying again.',
        isRetryable: true,
        statusCode: 429
      }
    }
    
    if (message.includes('500') || message.includes('internal server error')) {
      return {
        message: 'Server error. The AI service is temporarily unavailable.',
        isRetryable: true,
        statusCode: 500
      }
    }
    
    if (message.includes('503') || message.includes('service unavailable')) {
      return {
        message: 'Service temporarily unavailable. Please try again in a moment.',
        isRetryable: true,
        statusCode: 503
      }
    }
    
    if (message.includes('timeout')) {
      return {
        message: 'Request timed out. Please try again.',
        isRetryable: true
      }
    }
    
    if (message.includes('quota') || message.includes('exceeded')) {
      return {
        message: 'Quota exceeded. Check your API usage limits.',
        isRetryable: false
      }
    }

    // Return the error message as-is if it's user-friendly
    if (error.message && error.message.length < 200) {
      return {
        message: error.message,
        isRetryable: false
      }
    }
  }

  // Generic fallback
  return {
    message: 'An unexpected error occurred. Please try again.',
    isRetryable: true
  }
}

/**
 * Parse HTTP status codes into user-friendly messages
 */
function parseHttpError(status: number, statusText: string): ErrorInfo {
  switch (status) {
    case 400:
      return {
        message: 'Invalid request. Please check your input and try again.',
        isRetryable: false,
        statusCode: status
      }
    
    case 401:
      return {
        message: 'Invalid API key. Please check your settings.',
        isRetryable: false,
        statusCode: status
      }
    
    case 403:
      return {
        message: 'Access denied. Your API key may not have permission for this resource.',
        isRetryable: false,
        statusCode: status
      }
    
    case 404:
      return {
        message: 'Resource not found. The model or endpoint may not exist.',
        isRetryable: false,
        statusCode: status
      }
    
    case 429:
      return {
        message: 'Rate limit exceeded. Please wait before trying again.',
        isRetryable: true,
        statusCode: status
      }
    
    case 500:
      return {
        message: 'Server error. The AI service encountered an error.',
        isRetryable: true,
        statusCode: status
      }
    
    case 502:
      return {
        message: 'Bad gateway. Please try again in a moment.',
        isRetryable: true,
        statusCode: status
      }
    
    case 503:
      return {
        message: 'Service unavailable. Please try again later.',
        isRetryable: true,
        statusCode: status
      }
    
    case 504:
      return {
        message: 'Gateway timeout. The request took too long.',
        isRetryable: true,
        statusCode: status
      }
    
    default:
      return {
        message: `Error ${status}: ${statusText || 'Unknown error'}`,
        isRetryable: status >= 500,
        statusCode: status
      }
  }
}

/**
 * Format error for logging (includes full details)
 */
export function formatErrorForLogging(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}\n${error.stack || ''}`
  }
  return String(error)
}
