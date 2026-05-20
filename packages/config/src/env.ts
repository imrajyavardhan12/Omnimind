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
