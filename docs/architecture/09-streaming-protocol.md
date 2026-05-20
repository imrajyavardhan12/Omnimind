# 09 — Streaming Protocol

## Decision

Use Server-Sent Events, or SSE, as the primary streaming mechanism for v2 chat runs.

SSE is a good fit because model streaming is mostly server-to-client. WebSockets can be introduced later for collaboration, live presence, or interactive tool approval.

## Goals

The streaming protocol should support:

- One stream per user-submitted run.
- Multiple model responses in the same stream.
- Partial failure per model.
- Retry status events.
- Usage/cost events.
- Cancellation events.
- Client reconnection where possible.

## Endpoint Shape

Use a create-then-subscribe model:

```txt
POST /v1/chat/runs
GET  /v1/chat/runs/:runId/events
```

Do not create a separate `POST /v1/chat/runs/stream` endpoint for v2.

Create-then-subscribe is easier to reconnect, inspect, debug, and share across durable run IDs.

## Event Envelope

Every SSE event should have a typed JSON payload.

```ts
export interface StreamEnvelope<TType extends string, TData> {
  type: TType
  runId: string
  sequence: number
  timestamp: string
  data: TData
}
```

The `sequence` number is important for ordering, debugging, and possible replay.

## Event Types

### Run Events

```txt
run.started
run.completed
run.failed
run.cancelled
```

### Model Run Events

```txt
model.queued
model.started
model.delta
model.retrying
model.completed
model.failed
model.cancelled
```

### Usage Events

```txt
usage.updated
```

### System Events

```txt
heartbeat
error
```

## Example Stream

```txt
event: run.started
data: {"type":"run.started","runId":"run_123","sequence":1,"data":{"conversationId":"conv_1"}}

event: model.started
data: {"type":"model.started","runId":"run_123","sequence":2,"data":{"modelRunId":"mr_1","provider":"openai","model":"gpt-4o"}}

event: model.delta
data: {"type":"model.delta","runId":"run_123","sequence":3,"data":{"modelRunId":"mr_1","text":"Hello"}}

event: model.completed
data: {"type":"model.completed","runId":"run_123","sequence":4,"data":{"modelRunId":"mr_1","usage":{"inputTokens":10,"outputTokens":20,"totalTokens":30},"costUsd":"0.00012"}}

event: run.completed
data: {"type":"run.completed","runId":"run_123","sequence":5,"data":{}}
```

## Model Delta Event

```ts
export interface ModelDeltaEvent {
  modelRunId: string
  text: string
}
```

## Model Completed Event

```ts
export interface ModelCompletedEvent {
  modelRunId: string
  finishReason?: string
  usage?: TokenUsage
  costUsd?: string
  latencyMs: number
}
```

## Model Failed Event

```ts
export interface ModelFailedEvent {
  modelRunId: string
  error: {
    code: string
    message: string
    retryable: boolean
    provider?: string
    providerStatusCode?: number
  }
}
```

## Retry Event

```ts
export interface ModelRetryingEvent {
  modelRunId: string
  attempt: number
  maxAttempts: number
  delayMs: number
  reason: string
}
```

## Heartbeats

Send periodic heartbeat events to keep connections alive.

```txt
event: heartbeat
data: {"type":"heartbeat","runId":"run_123","sequence":10,"data":{}}
```

Recommended interval: 15–30 seconds.

## Reconnection

Store recent run events in Neon Postgres for durable replay and Upstash Redis for short-lived active stream coordination.

Client may reconnect with:

```txt
Last-Event-ID
```

or query param:

```txt
GET /v1/chat/runs/:runId/events?afterSequence=42
```

For early v2, full replay can be simplified by loading persisted run state and continuing current stream only if run is active.

## Cancellation

Cancellation should be an explicit API call:

```txt
POST /v1/chat/runs/:runId/cancel
```

The stream should then emit:

```txt
model.cancelled
run.cancelled
```

## Client Rendering Strategy

The client keeps an in-memory buffer by `modelRunId`:

```ts
Record<ModelRunId, string>
```

On `model.delta`, append text.

On `model.completed`, reconcile with persisted message when query invalidates/refetches.

## Why Not WebSockets Initially?

WebSockets are not required for the first v2 rebuild because chat token streaming is one-way. SSE is simpler, easier to debug, easier to deploy through proxies, and works well with HTTP infrastructure.

Use WebSockets later for:

- Live collaboration.
- Presence.
- Shared sessions.
- Tool approval prompts.
- Multi-user interactive workflows.
