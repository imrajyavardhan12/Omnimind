# 16 — Observability

## Goal

OmniMind v2 must be debuggable in production.

For every model response, we should be able to answer:

- Who triggered it?
- Which workspace?
- Which conversation?
- Which run?
- Which provider/model?
- What was the latency?
- Did it retry?
- Did it fail?
- How many tokens?
- What did it cost?

## Tools

Use exactly:

```txt
Sentry        → frontend/backend errors
OpenTelemetry → distributed tracing
Langfuse      → LLM tracing and prompt observability
PostHog       → product analytics
Axiom         → structured logs
```

## Structured Logging

All services should log JSON.

Common fields:

```txt
requestId
userId
workspaceId
conversationId
runId
modelRunId
provider
model
route
status
latencyMs
errorCode
```

Do not log provider keys.

## Tracing

Use OpenTelemetry spans around:

- HTTP requests.
- Database queries.
- Redis calls.
- Chat run orchestration.
- Provider calls.
- File extraction jobs.
- Council workflow stages.

Example trace:

```txt
POST /v1/chat/runs
  → create chat run db transaction
  → model run: openai/gpt-4o
      → provider request
      → stream tokens
      → persist message
      → write usage ledger
  → model run: anthropic/claude
      → provider request
      → stream tokens
      → persist message
      → write usage ledger
```

## LLM Observability

Use Langfuse to track:

- Prompt templates.
- Rendered prompts where policy allows.
- Model parameters.
- Provider/model.
- Token usage.
- Cost.
- Latency.
- Errors.
- User feedback.

Sensitive content logging should be configurable.

## Metrics

Core metrics:

```txt
chat_runs_created_total
chat_runs_completed_total
chat_runs_failed_total
model_runs_created_total
model_runs_completed_total
model_runs_failed_total
provider_latency_ms
provider_error_rate
provider_rate_limit_count
tokens_input_total
tokens_output_total
cost_usd_total
active_sse_connections
file_upload_bytes_total
file_extraction_failures_total
```

## Dashboards

Create dashboards for:

### Product

- Daily active users.
- Runs per day.
- Compare mode usage.
- Council mode usage.
- Prompt enhancement usage.

### AI Operations

- Model latency.
- Model error rate.
- Provider 429s.
- Cost by provider/model.
- Token usage.

### Infrastructure

- API latency.
- API error rate.
- DB latency.
- Redis latency.
- SSE connection count.
- Worker job failures.

## Alerts

Recommended alerts:

```txt
API 5xx rate > threshold
Provider 5xx/429 spike
Hosted provider spend spike
Worker job failure spike
Database latency high
SSE connection failure spike
File extraction failure spike
```

## User Feedback Loop

Add thumbs up/down or quality feedback per model response.

Store:

```txt
message_id
model_run_id
rating
feedback_text
created_by_user_id
created_at
```

This enables future model quality analytics.

## Request IDs

Every request should receive a request ID at the edge/API.

Return it in response headers:

```txt
X-Request-ID
```

Include it in error responses.

## Redaction

Telemetry must redact:

- Provider API keys.
- Auth tokens.
- Cookies.
- Sensitive headers.
- Large file payloads.

Prompt/message content redaction policy should be configurable per environment/workspace.

## Development Observability

In local dev:

- Pretty logs.
- Console trace IDs.
- Optional local Langfuse disabled by default.
- Mock provider mode for tests.

## Production Incident Workflow

When a user reports a bad response:

1. Locate conversation.
2. Find chat run.
3. Inspect model run records.
4. Check provider request IDs.
5. Check usage/cost.
6. Check stream events.
7. Check logs/traces by `runId`.
8. Reproduce if needed with redacted inputs.
