import { z } from "zod"

const baseEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
})

export const apiEnvSchema = baseEnvSchema.extend({
  PORT: z.coerce.number().default(3001),
  API_VERSION: z.string().default("0.1.0"),
  DATABASE_URL: z.string().url(),
  CLERK_SECRET_KEY: z.string().min(1),
  ALLOWED_ORIGIN: z.string().url().default("http://localhost:3000"),
  PROVIDER_KEY_ENCRYPTION_SECRET: z.string().regex(/^[0-9a-fA-F]{64}$/, 'PROVIDER_KEY_ENCRYPTION_SECRET must be exactly 64 hex characters (32 bytes)'),
  // Cloudflare R2 object storage (M7B file pipeline). Required at boot: the
  // file routes issue real signed URLs and verify uploads against R2, so a
  // missing value is a configuration error, not a runtime fallback (ADR 0007).
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET: z.string().min(1),
  R2_ENDPOINT: z.string().url(),
  // M9B cost protection (all optional — safe defaults per 15-cost-controls.md
  // Initial Defaults; override in apps/api/.env.local for paid tiers).
  WORKSPACE_MONTHLY_BUDGET_USD: z.coerce.number().positive().default(50),
  RATE_LIMIT_CHAT_RUNS_PER_MIN: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_COUNCIL_RUNS_PER_MIN: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_FILE_UPLOADS_PER_HOUR: z.coerce.number().int().positive().default(100),
  // Upstash Redis (15-cost-controls.md) — reserved for the distributed swap.
  // Absent in dev/single-instance: the API uses the in-process limiter and
  // documents the limitation in apps/api/src/lib/rate-limit.ts.
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
})

export type ApiEnv = z.infer<typeof apiEnvSchema>

export function parseApiEnv(raw: NodeJS.ProcessEnv = process.env): ApiEnv {
  return apiEnvSchema.parse(raw)
}

export const webEnvSchema = baseEnvSchema.extend({
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_API_URL: z.string().url().default("http://localhost:3001"),
})

export type WebEnv = z.infer<typeof webEnvSchema>

export function parseWebEnv(raw: NodeJS.ProcessEnv = process.env): WebEnv {
  return webEnvSchema.parse(raw)
}
