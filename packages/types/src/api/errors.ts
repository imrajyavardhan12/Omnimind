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
  | "CHAT_RUN_NOT_FOUND"
  | "CHAT_RUN_ALREADY_COMPLETED"
  | "COUNCIL_RUN_NOT_FOUND"
  | "QUOTA_EXCEEDED"
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "INTERNAL_ERROR"

export interface ApiError {
  code: ErrorCode
  message: string
  requestId: string
}

export interface ApiErrorResponse {
  error: ApiError
}
