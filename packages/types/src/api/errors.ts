export type ErrorCode =
  | "PROVIDER_KEY_MISSING"
  | "PROVIDER_RATE_LIMITED"
  | "MODEL_CAPABILITY_UNSUPPORTED"
  | "CONTEXT_TOO_LARGE"
  | "BUDGET_EXCEEDED"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "INTERNAL_ERROR"

export interface ApiError {
  code: ErrorCode
  message: string
  requestId: string
}

export interface ApiErrorResponse {
  error: ApiError
}
