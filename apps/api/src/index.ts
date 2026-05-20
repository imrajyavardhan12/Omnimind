import { serve } from "@hono/node-server"
import { Hono } from "hono"
import { parseApiEnv } from "@omnimind/config"
import { healthRouter } from "./routes/health.js"

const env = parseApiEnv()
const app = new Hono()

app.route("/health", healthRouter)

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`OmniMind API running on http://localhost:${info.port}`)
})
