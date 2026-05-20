export interface HealthResponse {
  status: "ok" | "degraded" | "error"
  version: string
  timestamp: string
  service: string
}
