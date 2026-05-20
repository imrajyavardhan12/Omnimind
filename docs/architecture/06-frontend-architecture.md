# 06 — Frontend Architecture

## Goals

The frontend should become a clean product shell that renders server-backed state and subscribes to run events.

It should not own provider orchestration, canonical persistence, cost calculations, or provider key management.

## Technology

Use:

- Next.js App Router.
- React.
- Tailwind CSS.
- shadcn-style component primitives.
- TanStack Query for server state.
- Zustand for local UI state.
- EventSource/fetch streaming client for SSE.

## Route Structure

Recommended:

```txt
apps/web/src/app/
  (marketing)/
    page.tsx

  (auth)/
    auth/login/page.tsx
    auth/signup/page.tsx
    auth/callback/route.ts

  (app)/
    layout.tsx
    chat/page.tsx
    dashboard/page.tsx
    settings/page.tsx
    usage/page.tsx
```

## Feature Structure

```txt
apps/web/src/features/
  chat/
    components/
      ChatShell.tsx
      MessageList.tsx
      Composer.tsx
      ModelResponsePanel.tsx
      ModelPicker.tsx
    hooks/
      useChatRun.ts
      useConversation.ts
    api/
      chatApi.ts
    state/
      chatUiStore.ts

  models/
    components/
    api/

  settings/
    components/
    api/

  council/
    components/
    hooks/

  files/
    components/
    api/
```

## State Ownership

### Server State

Managed by TanStack Query:

- Conversations.
- Messages.
- Chat runs.
- Model catalog.
- Provider key metadata.
- Usage dashboard data.
- Workspace settings.

### Client/UI State

Managed by Zustand or component state:

- Current view mode.
- Draft text.
- Selected local models before submit.
- Open/closed modals.
- Sidebar collapse state.
- Temporary upload progress.

### Streaming State

Managed by a specialized hook, for example:

```ts
useChatRun(runId)
```

This hook should:

- Subscribe to SSE events.
- Update transient stream buffers.
- Reconcile final events with persisted server state.
- Support cancellation.
- Handle reconnect if possible.

## Unified Chat UX

Single, Compare, and Council should not be entirely separate systems.

Single mode:

```txt
one chat_run with one model_run
```

Compare mode:

```txt
one chat_run with multiple model_runs
```

Council mode:

```txt
one council_run with multiple workflow stages
```

## Composer Behavior

The composer should submit to the backend once:

```txt
POST /v1/chat/runs
```

It should not call each provider individually.

Payload includes:

- Conversation ID.
- Text.
- Attachment IDs.
- Selected model configs.
- Mode.

## Model Panels

Model response panels should render from stream events keyed by `modelRunId`.

They should not know provider API details.

Panel states:

- idle.
- queued.
- running.
- retrying.
- completed.
- failed.
- cancelled.

## Error Handling

Every model panel should be able to show a model-specific error without failing the entire run.

Examples:

- Missing provider key.
- Provider 429.
- Model unsupported.
- Context too large.
- Safety filter.
- Network timeout.

## File Upload UX

The composer should upload files before run submission.

Flow:

```txt
1. User selects files.
2. Client asks API for a signed Cloudflare R2 upload URL.
3. File records are created.
4. Composer submits attachment IDs with the prompt.
```

Do not embed large base64 file payloads in messages.

## Recommended Frontend API Client

Create thin API clients per feature:

```ts
features/chat/api/chatApi.ts
features/settings/api/providerKeysApi.ts
features/files/api/filesApi.ts
```

Do not scatter raw `fetch()` calls throughout components.

## Accessibility and UX Requirements

- Keyboard shortcuts should be centralized.
- Streaming text should not cause layout jank.
- Long conversations should be virtualized if needed.
- Composer should support keyboard-first usage.
- Loading/error states should be explicit per model.
- Mobile layout should be designed separately, not just squeezed desktop UI.

## Migration from Current UI

Keep useful components visually, but rewire them around backend runs:

Current:

```txt
AnimatedUnifiedInput → direct fetch per model
```

Target:

```txt
Composer → POST /v1/chat/runs → subscribe to unified stream
```

Current:

```txt
Chat store persists all messages in localStorage
```

Target:

```txt
TanStack Query loads messages from API
Zustand holds draft and UI state only
```
