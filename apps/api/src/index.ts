import { serve } from "@hono/node-server"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { parseApiEnv } from "@omnimind/config"
import { createDb } from "@omnimind/db"
import { healthRouter } from "./routes/health.js"
import { createConversationsRouter } from "./routes/conversations.js"
import { createMessagesRouter } from "./routes/messages.js"
import { createProviderKeysRouter } from "./routes/provider-keys.js"
import { createModelsRouter } from "./routes/models.js"
import { createChatRunsRouter } from "./routes/chat-runs.js"
import { createCouncilRouter } from "./routes/council.js"
import { createFilesRouter } from "./routes/files.js"
import { createR2Client } from "./lib/r2.js"
import { createAuthMiddleware } from "./middleware/auth.js"
import { createWorkspaceMiddleware } from "./middleware/workspace.js"
import { requestIdMiddleware } from "./middleware/request-id.js"
import { requestLoggerMiddleware } from "./middleware/request-logger.js"
import { notFoundHandler, onErrorHandler } from "./lib/error-response.js"
import { RunCoordinator } from "./services/run-coordinator.js"
import { CORS_ALLOW_HEADERS } from "./cors.js"
import type { ApiVariables } from "./types.js"

const env = parseApiEnv()
const db = createDb(env.DATABASE_URL)
const runCoordinator = new RunCoordinator()
const r2Client = createR2Client({
  accountId: env.R2_ACCOUNT_ID,
  accessKeyId: env.R2_ACCESS_KEY_ID,
  secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  bucket: env.R2_BUCKET,
  endpoint: env.R2_ENDPOINT,
})

const app = new Hono<{ Variables: ApiVariables }>()

app.use("*", requestIdMiddleware)
app.use("*", requestLoggerMiddleware)

// Stable JSON error envelopes (never HTML stack traces) + server-side logging.
app.onError(onErrorHandler)
app.notFound(notFoundHandler)

app.use(
  "*",
  cors({
    origin: env.ALLOWED_ORIGIN,
    allowHeaders: [...CORS_ALLOW_HEADERS],
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
v1.route("/models", createModelsRouter(db))
v1.route("/chat/runs", createChatRunsRouter(db, env.PROVIDER_KEY_ENCRYPTION_SECRET, runCoordinator))
v1.route("/council/runs", createCouncilRouter(db, env.PROVIDER_KEY_ENCRYPTION_SECRET, runCoordinator))
v1.route("/files", createFilesRouter(db, { client: r2Client, bucket: env.R2_BUCKET }))

app.route("/v1", v1)

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`OmniMind API running on http://localhost:${info.port}`)
})
