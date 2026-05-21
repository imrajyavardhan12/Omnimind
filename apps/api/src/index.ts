import { serve } from "@hono/node-server"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { parseApiEnv } from "@omnimind/config"
import { createDb } from "@omnimind/db"
import { healthRouter } from "./routes/health.js"
import { createConversationsRouter } from "./routes/conversations.js"
import { createMessagesRouter } from "./routes/messages.js"
import { createProviderKeysRouter } from "./routes/provider-keys.js"
import { createAuthMiddleware } from "./middleware/auth.js"
import { createWorkspaceMiddleware } from "./middleware/workspace.js"
import { requestIdMiddleware } from "./middleware/request-id.js"
import type { ApiVariables } from "./types.js"

const env = parseApiEnv()
const db = createDb(env.DATABASE_URL)

const app = new Hono<{ Variables: ApiVariables }>()

app.use("*", requestIdMiddleware)

app.use(
  "*",
  cors({
    origin: env.ALLOWED_ORIGIN,
    allowHeaders: ["Content-Type", "Authorization", "x-request-id"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  }),
)

app.route("/health", healthRouter)

const authMiddleware = createAuthMiddleware(env.CLERK_SECRET_KEY, [env.ALLOWED_ORIGIN])
const workspaceMiddleware = createWorkspaceMiddleware(db, env.CLERK_SECRET_KEY)

const v1 = new Hono<{ Variables: ApiVariables }>()
v1.use("*", authMiddleware)
v1.use("*", workspaceMiddleware)
v1.route("/conversations", createConversationsRouter(db))
v1.route("/conversations/:conversationId/messages", createMessagesRouter(db))
v1.route("/provider-keys", createProviderKeysRouter(db, env.PROVIDER_KEY_ENCRYPTION_SECRET))

app.route("/v1", v1)

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`OmniMind API running on http://localhost:${info.port}`)
})
