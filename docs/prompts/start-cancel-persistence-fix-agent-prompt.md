Start prompt — Cancel-persistence fix (run-engine), then post-M6.5 roadmap

CURRENT STATE (2026-06-03):
- origin/main @ee36884. M6.5 (Frontend Foundation) is merged: single + compare are a clean,
  dogfoodable backend-run chat (RunChatView is the only single/compare path; backend-wired
  conversation sidebar; owned ChatMarkdown renderer; legacy dual-path removed). The backend
  run engine is unchanged since M5.
- Reading mode: TASK mode. Read AGENTS.md, docs/handoff-m6.5.md, docs/handoff-m6.md (addendum),
  docs/architecture/06b-frontend-standards.md, and for THIS task:
  docs/architecture/07-backend-architecture.md, 09-streaming-protocol.md, 10-data-model.md,
  plus the M5B handoff (docs/handoff-m5b.md) for the run-engine design + db.batch atomics.

=====================================================================================
TASK (#1 follow-up from M6.5 dogfooding): persist partial assistant output on cancel.
=====================================================================================

PROBLEM (reproduced live):
  Ask a model something, cancel mid-stream, then ask a second question in the same
  conversation. Observed: (a) the partial answer you already saw vanishes; (b) the model
  answers BOTH questions ("merge").
  Root cause: on cancel, the run engine marks the chat_model_run cancelled but does NOT
  persist the partial assistant text. The user prompt WAS persisted at run start, so the
  conversation is left with a dangling unanswered question; the next run's context
  (findRecentByConversation) includes it, so the model answers both. The partial vanishes
  because it lived only in the client's transient buffer.

GOAL:
  On cancel, persist the partial assistant text as a message linked to the cancelled
  chat_model_run (status cancelled), with usage if known. Then the partial stays in history
  and the next turn sees an answered pair, not a dangling question.

WHERE TO LOOK (trace before changing):
  - apps/api/src/services/chat-run.service.ts — executeRun lifecycle + the cancellation path
    (status -> cancelled when the AbortSignal fires). This is where streamed deltas are
    consumed; capture the accumulated text so it is available at cancel time.
  - apps/api/src/services/run-coordinator.ts — AbortController registry / cancel signal.
  - packages/db ChatRunWriteRepository.completeModelRun — the atomic completion batch
    (assistant message + model-run update + usage_ledger via db.batch). A cancelled run needs
    an analogous "finalize with partial" write. NOTE: neon-http driver, NO interactive tx —
    use db.batch (see [[project_neon_http_batch]] / handoff-m5b).
  - apps/api/src/routes/chat-runs.ts — POST /:runId/cancel.

SUGGESTED APPROACH (confirm against the code):
  - Accumulate streamed text during executeRun so the partial is in hand when cancel fires.
  - On cancel with non-empty partial: write a completion-like db.batch for the model run —
    assistant message (the partial), model-run update status='cancelled' + output_message_id,
    usage if available else usage_source='estimated'/null cost; then a usage_ledger row.
    Keep emitting model.cancelled / run.cancelled as today (no new SSE event types).
  - Empty partial (cancelled before any token): keep today's behavior (no assistant message);
    consider deleting the dangling user message OR leaving it — decide and document.
  - Frontend: computeLivePanels already matches persisted messages by modelRunId, so a
    cancelled message WITH content should reconcile with NO frontend change. Verify; if a
    cancelled message needs a visual marker, that is a small RunMessageList follow-up.

ACCEPTANCE:
  - Cancel mid-stream -> the partial answer persists (visible after refresh), linked to the
    cancelled model run; the next prompt in the same conversation is NOT polluted.
  - Run/model status = cancelled; usage_ledger consistent (partial or estimated).
  - Gates green (type-check / lint / test / build); add a chat-run.service test for the
    cancel-with-partial path (the suite mocks the gateway stream + db.batch).
  - Update 09-streaming-protocol.md / 10-data-model.md if cancel semantics change.

GUARDRAILS: backend change — db.batch atomics only (no interactive tx); no provider keys in
logs/rows/events; typed SSE envelopes from @omnimind/types unchanged; small reviewable steps;
branch off main, do not commit to main directly.

=====================================================================================
AFTER THIS — sequence by real usage, not fixed plan order:
  - Dogfood the core; let what annoys you set priority.
  - Stale OpenRouter slugs: re-sync model_catalog (needs M3 POST /v1/models/sync, unbuilt).
  - M7 (file pipeline): composer uploads BEFORE run creation -> input.attachmentIds (already
    in createRunRequestSchema); file tables + R2 signed upload + extraction worker
    (docs/architecture/12-file-pipeline.md).
  - M8 (council v2): migrate Council off the legacy path -> then delete the MarkdownRenderer
    shim (apps/web/src/components/chat/MarkdownRenderer.tsx) + the legacy localStorage stores.
  - M9 (observability): start with a THIN slice — API request logging + error surfacing (the
    API has none today) — before Sentry/Langfuse/OTel.
=====================================================================================
