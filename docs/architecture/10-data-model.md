# 10 — Data Model

## Goals

The data model should make OmniMind durable, auditable, debuggable, and billing-ready.

Core concepts:

- Workspaces.
- Conversations.
- Messages.
- Chat runs.
- Model runs.
- Provider keys.
- Model catalog.
- Usage ledger.
- Files.
- Audit logs.

## Entity Relationship Overview

```txt
user ─┬─ workspace_member ─ workspace
      │                         │
      │                         ├─ provider_key
      │                         ├─ conversation ─ message ─ attachment
      │                         │       └─ chat_run ─ chat_model_run
      │                         ├─ file
      │                         ├─ usage_ledger
      │                         └─ audit_log
      │
      └─ user_preferences
```

## Tables

### `app_users`

Internal user profile mapped to Clerk identity.

```txt
id
clerk_user_id unique
email
name nullable
avatar_url nullable
created_at
updated_at
```

Clerk owns authentication. OmniMind owns application user records, workspace membership, usage, and audit relationships.

### `workspaces`

```txt
id
name
slug
created_at
updated_at
```

Even if the first product is single-user, use workspaces from day one. It prevents painful migration later.

### `workspace_members`

```txt
id
workspace_id
user_id
role                 -- owner, admin, member, viewer
created_at
updated_at
```

### `provider_keys`

Stores encrypted BYOK provider keys.

```txt
id
workspace_id
provider             -- openai, anthropic, google, openrouter, etc.
encrypted_key
key_fingerprint      -- non-secret hash/prefix for display/debug
status               -- active, invalid, revoked
last_validated_at
created_by_user_id
created_at
updated_at
```

Never store plaintext provider keys.

### `model_catalog`

```txt
id
provider
model_id
display_name
description
context_window
max_output_tokens
input_cost_per_1m
output_cost_per_1m
supports_streaming
supports_vision
supports_tools
supports_json
supports_files
speed_tier
quality_tier
is_enabled
is_deprecated
metadata_json
created_at
updated_at
```

### `conversations`

```txt
id
workspace_id
created_by_user_id
title
mode                 -- single, compare, council
status               -- active, archived, deleted
created_at
updated_at
```

### `messages`

```txt
id
conversation_id
workspace_id
role                 -- user, assistant, system, tool
content_text
model_run_id nullable
provider nullable
model nullable
created_by_user_id nullable
created_at
updated_at
```

Assistant messages produced by model calls should link to `chat_model_runs`.

### `message_attachments`

```txt
id
message_id
file_id
attachment_role      -- user_upload, model_input, generated_output
created_at
```

### `chat_runs`

A chat run represents one user action.

```txt
id
workspace_id
conversation_id
created_by_user_id
input_message_id
mode                 -- single, compare
status               -- queued, running, completed, failed, cancelled
idempotency_key
started_at
completed_at
created_at
updated_at
```

### `chat_model_runs`

A model run represents one provider/model response inside a chat run.

```txt
id
chat_run_id
workspace_id
provider
model
status               -- queued, running, retrying, completed, failed, cancelled
settings_json        -- temperature, max tokens, system prompt reference
output_message_id nullable
provider_request_id nullable
error_code nullable
error_message nullable
input_tokens nullable
output_tokens nullable
total_tokens nullable
usage_source         -- provider, estimated
cost_usd nullable
latency_ms nullable
started_at nullable
completed_at nullable
created_at
updated_at
```

### `chat_run_events`

Optional but useful for replay/debugging.

```txt
id
chat_run_id
sequence
event_type
payload_json
created_at
```

This can be retained for recent runs or permanently depending on storage cost.

### `files`

```txt
id
workspace_id
uploaded_by_user_id
storage_bucket
storage_key
filename
mime_type
size_bytes
sha256
status               -- uploaded, processing, ready, failed, deleted
extracted_text_key nullable
metadata_json
created_at
updated_at
```

### `file_extractions`

```txt
id
file_id
status               -- queued, running, completed, failed
extraction_type      -- pdf_text, ocr, transcription, docx_text
output_text
output_storage_key nullable
error_message nullable
created_at
updated_at
```

### `usage_ledger`

Append-only usage/cost ledger.

```txt
id
workspace_id
user_id
conversation_id nullable
chat_run_id nullable
chat_model_run_id nullable
provider
model
input_tokens
output_tokens
total_tokens
usage_source         -- provider, estimated
cost_usd
currency             -- USD
created_at
```

Do not update rows except for correction workflows. Prefer append-only accounting.

### `audit_logs`

```txt
id
workspace_id
actor_user_id nullable
action               -- provider_key.created, chat_run.cancelled, etc.
entity_type
entity_id
ip_address nullable
user_agent nullable
metadata_json
created_at
```

### `prompt_enhancements`

```txt
id
workspace_id
user_id
conversation_id nullable
original_prompt
enhanced_prompt
provider nullable
model nullable
status
created_at
```

### `council_runs`

```txt
id
workspace_id
conversation_id nullable
created_by_user_id
query
chairman_provider
chairman_model
status               -- queued, stage1, stage2, stage3, completed, failed, cancelled
created_at
started_at
completed_at
updated_at
```

### `council_stage_results`

```txt
id
council_run_id
stage                -- stage1, stage2, stage3
model_provider nullable
model_id nullable
payload_json
status
created_at
updated_at
```

## Indexing Strategy

Important indexes:

```txt
conversations(workspace_id, updated_at desc)
messages(conversation_id, created_at)
chat_runs(conversation_id, created_at desc)
chat_model_runs(chat_run_id)
usage_ledger(workspace_id, created_at desc)
files(workspace_id, created_at desc)
audit_logs(workspace_id, created_at desc)
provider_keys(workspace_id, provider)
model_catalog(provider, model_id)
```

## Soft Deletes

Use soft deletes for user-facing resources:

- conversations.
- files.
- provider keys.

Do not soft-delete usage ledger or audit logs unless compliance policy demands it.

## Retention

Suggested defaults:

- Chat run events: 30–90 days if verbose.
- Messages: until user deletes conversation.
- Usage ledger: permanent or billing retention period.
- Audit logs: 1 year minimum for production.
- Raw uploaded files: configurable retention.

## Migration Note

Existing localStorage sessions can be migrated by a client-side import flow:

```txt
Detect local sessions → ask user to import → POST conversations/messages to API → clear local legacy state after confirmation
```
