import { z } from "zod"

const baseEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
})

export const apiEnvSchema = baseEnvSchema.extend({
  PORT: z.coerce.number().default(3001),
  API_VERSION: z.string().default("0.1.0"),
})

export type ApiEnv = z.infer<typeof apiEnvSchema>

export function parseApiEnv(raw: NodeJS.ProcessEnv = process.env): ApiEnv {
  return apiEnvSchema.parse(raw)
}
