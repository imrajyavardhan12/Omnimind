# 19 — Domain Glossary

This glossary defines the core product and engineering terms used across OmniMind v2.

## User

An authenticated person using OmniMind.

## Workspace

A security and billing boundary that owns conversations, provider keys, files, usage, and members.

Even if a user is solo, they should have a default personal workspace.

## Workspace Member

A user assigned to a workspace with a role such as owner, admin, member, or viewer.

## Provider

An external AI service vendor.

Examples:

- OpenAI
- Anthropic
- Google
- OpenRouter
- Mistral
- xAI
- Groq

## Model

A specific model identifier offered by a provider.

Examples:

- `gpt-4o`
- `claude-sonnet-4-5`
- `gemini-2.0-flash`
- `openai/gpt-4o` through OpenRouter

## Model Catalog

The server-side registry of available models, their capabilities, limits, and pricing.

## Capability

A model feature or constraint.

Examples:

- supports streaming
- supports vision
- supports tool calls
- supports JSON mode
- context window
- max output tokens

## Provider Key

A user/workspace-owned API key for a provider.

In v2, provider keys are encrypted server-side and never returned to the browser.

## Hosted Provider Key

A provider key owned by OmniMind, used for free trials or hosted usage.

Hosted usage requires strict rate limits, quotas, and abuse controls.

## Conversation

A durable thread of messages.

A conversation belongs to a workspace and can contain user, assistant, system, and tool messages.

## Message

A single conversational item.

Message roles include:

- user
- assistant
- system
- tool

Assistant messages produced by models should link to a `chat_model_run`.

## Chat Run

A durable record representing one user prompt submission.

One user action equals one `chat_run`.

## Model Run

A single provider/model execution inside a chat run.

If a user sends one prompt to five models, OmniMind creates one chat run and five model runs.

## Run Event

A typed event emitted during a run.

Examples:

- `run.started`
- `model.started`
- `model.delta`
- `model.completed`
- `model.failed`

## SSE

Server-Sent Events.

The primary v2 transport for streaming run events from backend to frontend.

## LLM Gateway

The internal abstraction that normalizes provider/model invocation.

The rest of the app should call the LLM Gateway instead of provider APIs directly.

## Chat Orchestrator

The backend service/module that creates runs, assembles context, fans out model calls, streams events, persists results, and writes usage ledger entries.

## Usage Ledger

Append-only table recording token usage and cost for every model call.

## Cost Source

How token/cost data was determined.

Examples:

- provider-reported
- estimated
- corrected

## File

A durable uploaded object owned by a workspace.

Files are stored in Cloudflare R2, not localStorage or raw database columns.

## File Extraction

A background process that converts an uploaded file into usable text/metadata.

Examples:

- PDF text extraction
- OCR
- audio transcription
- DOCX text extraction

## Attachment

A relationship between a message and a file.

## Council Run

A durable multi-stage workflow where multiple models answer, critique, rank, and synthesize a final answer.

## Chairman Model

The model responsible for the final synthesis in Council Mode.

## BYOK

Bring Your Own Key.

A mode where users supply their own provider API keys.

## Audit Log

A durable record of important actions such as provider key creation, file deletion, and budget changes.

## Idempotency Key

A client-provided unique key used to avoid duplicate mutation effects when requests are retried.

## Partial Failure

A condition where part of a multi-model operation fails but the overall run can still complete.

Example: Claude fails due to rate limits while GPT-4o and Gemini complete successfully.
