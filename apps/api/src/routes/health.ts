import { Hono } from "hono"
import type { HealthResponse } from "@omnimind/types"

export const healthRouter = new Hono()

healthRouter.get("/", (c) => {
  const response: HealthResponse = {
    status: "ok",
    version: process.env["API_VERSION"] ?? "0.1.0",
    timestamp: new Date().toISOString(),
    service: "omnimind-api",
  }
  return c.json(response)
})
