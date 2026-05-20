# 11 — API Design

## Principles

1. API is workspace-aware.
2. API is typed with shared Zod schemas.
3. API returns stable error codes.
4. API supports idempotent mutation where needed.
5. API separates run creation from event streaming.
6. API never exposes provider secrets.

## Base Path

```txt
/v1
```

## Auth

All app APIs require authentication except public health checks and auth callbacks.

Auth is resolved from secure session/cookie or bearer token depending deployment.

Every route should resolve:

```txt
userId
workspaceId
role
permissions
```

## Conversations

### List Conversations

```txt
GET /v1/conversations
```

Query params:

```txt
limit
cursor
status
mode
```

### Create Conversation

```txt
POST /v1/conversations
```

Body:

```json
{
  "title": "New conversation",
  "mode": "single"
}
```

### Get Conversation

```txt
GET /v1/conversations/:conversationId
```

### Update Conversation

```txt
PATCH /v1/conversations/:conversationId
```

### Delete Conversation

```txt
DELETE /v1/conversations/:conversationId
```

## Messages

### List Messages

```txt
GET /v1/conversations/:conversationId/messages
```

Query params:

```txt
limit
cursor
```

## Chat Runs

### Create Chat Run

```txt
POST /v1/chat/runs
```

Headers:

```txt
Idempotency-Key: uuid
```

Body:

```json
{
  "conversationId": "conv_123",
  "input": {
    "text": "Explain OAuth simply.",
    "attachmentIds": []
  },
  "models": [
    {
      "provider": "openai",
      "model": "gpt-4o",
      "settings": {
        "temperature": 0.7,
        "maxOutputTokens": 2048,
        "systemPrompt": "Be concise."
      }
    }
  ],
  "context": {
    "messageLimit": 20
  }
}
```

Response:

```json
{
  "runId": "run_123",
  "conversationId": "conv_123",
  "eventStreamUrl": "/v1/chat/runs/run_123/events"
}
```

### Stream Chat Run Events

```txt
GET /v1/chat/runs/:runId/events
```

Response content type:

```txt
text/event-stream
```

### Get Chat Run

```txt
GET /v1/chat/runs/:runId
```

### Cancel Chat Run

```txt
POST /v1/chat/runs/:runId/cancel
```

Response:

```json
{
  "status": "cancelled"
}
```

## Models

### List Models

```txt
GET /v1/models
```

Query params:

```txt
provider
capability
enabledOnly
```

### Sync Provider Models

Admin/internal:

```txt
POST /v1/models/sync
```

## Provider Keys

### List Provider Key Metadata

```txt
GET /v1/provider-keys
```

Response must not include plaintext keys.

```json
{
  "keys": [
    {
      "provider": "openai",
      "status": "active",
      "fingerprint": "sk-...abcd",
      "lastValidatedAt": "2026-05-20T00:00:00Z"
    }
  ]
}
```

### Create or Update Provider Key

```txt
PUT /v1/provider-keys/:provider
```

Body:

```json
{
  "apiKey": "provider-secret"
}
```

Backend validates, encrypts, stores, and discards plaintext.

### Delete Provider Key

```txt
DELETE /v1/provider-keys/:provider
```

## Files

### Create Upload

```txt
POST /v1/files/uploads
```

Body:

```json
{
  "filename": "paper.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 123456
}
```

Response:

```json
{
  "fileId": "file_123",
  "uploadUrl": "https://...",
  "headers": {}
}
```

### Mark Upload Complete

```txt
POST /v1/files/:fileId/complete
```

### Get File

```txt
GET /v1/files/:fileId
```

### Delete File

```txt
DELETE /v1/files/:fileId
```

## Council Runs

### Create Council Run

```txt
POST /v1/council/runs
```

Body:

```json
{
  "query": "What is the best architecture for this app?",
  "councilModels": [
    { "provider": "openai", "model": "gpt-4o" },
    { "provider": "anthropic", "model": "claude-sonnet" }
  ],
  "chairmanModel": {
    "provider": "anthropic",
    "model": "claude-sonnet"
  }
}
```

### Stream Council Events

```txt
GET /v1/council/runs/:runId/events
```

### Cancel Council Run

```txt
POST /v1/council/runs/:runId/cancel
```

## Usage

### Get Usage Summary

```txt
GET /v1/usage/summary
```

Query params:

```txt
from
to
provider
model
```

### Get Usage Ledger

```txt
GET /v1/usage/ledger
```

## Error Response

Standard error shape:

```json
{
  "error": {
    "code": "PROVIDER_RATE_LIMITED",
    "message": "The provider is rate limited. Try again shortly.",
    "requestId": "req_123",
    "details": {}
  }
}
```

## Common Error Codes

```txt
UNAUTHENTICATED
FORBIDDEN
VALIDATION_ERROR
RATE_LIMITED
QUOTA_EXCEEDED
BUDGET_EXCEEDED
PROVIDER_KEY_MISSING
PROVIDER_AUTH_FAILED
MODEL_NOT_FOUND
MODEL_CAPABILITY_UNSUPPORTED
CONTEXT_TOO_LARGE
CHAT_RUN_NOT_FOUND
CHAT_RUN_ALREADY_COMPLETED
INTERNAL_ERROR
```
