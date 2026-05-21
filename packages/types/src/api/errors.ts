export type ErrorCode =
  | "UNAUTHENTICATED"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "PROVIDER_KEY_MISSING"
  | "PROVIDER_RATE_LIMITED"
  | "MODEL_CAPABILITY_UNSUPPORTED"
  | "CONTEXT_TOO_LARGE"
  | "BUDGET_EXCEEDED"
  | "INTERNAL_ERROR"

export interface ApiError {
  code: ErrorCode
  message: string
  requestId: string
}

export interface ApiErrorResponse {
  error: ApiError
}
