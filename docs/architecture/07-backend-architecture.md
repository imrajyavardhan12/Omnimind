# 07 — Backend Architecture

## Purpose

The backend should own all production-critical logic:

- Auth enforcement.
- API validation.
- Provider key lookup.
- Chat orchestration.
- Streaming.
- Usage accounting.
- Rate limiting.
- Auditing.
- Workflow initiation.

## Services

The v2 backend can start as a modular monolith deployed as one API service plus one worker service.

```txt
apps/api
apps/worker
packages/ai
packages/db
packages/types
packages/telemetry
```

This is not a microservice architecture. It is a modular backend with clear internal boundaries.

## API Gateway / BFF

### Responsibilities

- Authenticate user.
- Resolve workspace.
- Validate request body/query params.
- Enforce rate limits.
- Enforce quotas.
- Create chat/council/file records.
- Start streaming responses.
- Return typed API responses.

### Middleware Stack

Recommended middleware order:

```txt
request id
structured logging
error boundary
CORS/security headers
body size limit
auth
workspace resolution
rate limit
request validation
route handler
```

## Core Backend Modules

```txt
routes/
  chat.routes.ts
  conversations.routes.ts
  models.routes.ts
  provider-keys.routes.ts
  files.routes.ts
  council.routes.ts
  usage.routes.ts

services/
  chat-orchestrator.service.ts
  conversation.service.ts
  provider-key.service.ts
  model-catalog.service.ts
  usage-ledger.service.ts
  file.service.ts
  audit-log.service.ts
```

## Chat Orchestrator

### Responsibilities

- Create `chat_run` and `chat_model_run` records.
- Insert user message.
- Assemble context.
- Validate selected models.
- Fan out model requests.
- Emit stream events.
- Persist assistant messages.
- Write usage ledger entries.
- Handle cancellation.
- Handle partial failures.

### Internal Flow

```txt
createRun(input)
  → validate models and provider keys
  → persist user message
  → create model run rows
  → emit run.started
  → execute model calls concurrently with concurrency limit
  → stream deltas
  → persist completed model outputs
  → write usage ledger
  → emit run.completed
```

## Concurrency

Avoid unconstrained fan-out.

Per run:

- Limit selected models to configured maximum, e.g. 5.
- Limit concurrent model executions per user/workspace.
- Use queue/concurrency utilities for large runs.

## Cancellation

Cancellation should be backend-coordinated.

Flow:

```txt
POST /v1/chat/runs/:runId/cancel
  → set cancellation flag in Upstash Redis and persist terminal state in Neon Postgres
  → abort active provider requests
  → mark pending/running model runs as cancelled
  → emit run.cancelled/model.cancelled events
```

## Error Model

Normalize errors into stable application codes.

Examples:

```txt
PROVIDER_AUTH_FAILED
PROVIDER_RATE_LIMITED
PROVIDER_TIMEOUT
MODEL_NOT_SUPPORTED
CONTEXT_TOO_LARGE
CONTENT_FILTERED
BUDGET_EXCEEDED
USER_CANCELLED
UNKNOWN_PROVIDER_ERROR
```

Each error should include:

- Public-safe message.
- Internal debug metadata.
- Retryable flag.
- Provider status code if relevant.

## Idempotency

Run creation should support idempotency keys.

This prevents duplicate runs if the browser retries a request.

Header:

```txt
Idempotency-Key: uuid
```

## Background Worker

Use worker for:

- Council workflows.
- File extraction.
- Provider model sync.
- Usage rollups.
- Export generation.
- Cleanup tasks.

## Data Access

Use repositories for database access rather than raw DB calls scattered everywhere.

Example:

```txt
repositories/conversation.repository.ts
repositories/chat-run.repository.ts
repositories/usage-ledger.repository.ts
```

## Transaction Boundaries

Use DB transactions for:

- Creating user message + chat run + model run rows.
- Completing model run + assistant message + usage ledger entry.
- Provider key creation/update.

Avoid long-running transactions around provider calls.

## Backpressure

Streaming endpoints should handle:

- Client disconnects.
- Slow clients.
- Provider stream errors.
- Run cancellation.

If client disconnects, backend may either:

1. Continue the run and persist results.
2. Cancel the run.

Recommended default:

- Single/compare runs: continue briefly or cancel based on user setting.
- Council/background workflows: continue regardless of client connection.

## Validation

Use Zod schemas from `packages/types` for:

- Request payloads.
- Response payloads.
- Stream events.
- Internal event messages.

## Logging

Every request should include:

- `requestId`.
- `userId`.
- `workspaceId`.
- `runId` where relevant.
- Route.
- Latency.
- Status code.

Never log raw provider keys.
