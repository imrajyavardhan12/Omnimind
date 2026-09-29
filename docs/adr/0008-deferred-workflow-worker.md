# ADR 0008 — Defer the Queue-Backed Workflow Worker (Ship In-Process First)

## Status

Accepted

## Context

The architecture docs name a durable workflow engine for run orchestration:
`13-council-workflow.md` says "Use Inngest for Council Mode workflows",
`04-technology-stack.md` lists Inngest as the workflow engine, and
`03-system-architecture.md` / `17-infrastructure.md` place a Render Background
Worker + Inngest handlers behind the API.

M5 (chat run engine) and M8 (council v2) instead shipped an in-process
`RunCoordinator` with persisted progress rows (`chat_run_events` for replay,
`council_runs` + `council_stage_results` as the durable record). SSE is
create-then-subscribe with live-only council streams and run detail as the
reconnect source of truth.

Standing up Inngest now would mean a new vendor account, new secrets, a worker
runtime, and new failure modes — before any production traffic exists to
justify them. This ADR records the deferral and the conditions for revisit,
following the precedent of ADR 0007 (inline extraction before a worker).

## Decision

Ship and operate run orchestration **in-process** until a revisit trigger fires:

1. **No Inngest, no queue worker in v2 core.** Chat and council runs execute
   detached in the API process via `RunCoordinator`. Durability comes from
   persisted rows, not from a queue.
2. **Known limitation, stated plainly:** an API restart mid-run orphans the
   run (cancel marks it terminal; council SSE is live-only by design).
   Acceptable pre-launch; the launch checklist (M10) must re-examine it.
3. **The swap stays cheap:** orchestration lives in `ChatRunService` /
   `CouncilService` behind stable HTTP contracts, so introducing a worker
   later is a runtime change, not an API change.

## Revisit When

Any of these becomes true:

- API restarts orphan runs at a rate operators notice (before that: accept).
- P95 council latency (5 sequential model calls + synthesis) exceeds what a
  single request lifecycle tolerates.
- Horizontal API replicas need shared run ownership (in-process coordination
  cannot span replicas — same trigger as the Redis swap in M9B's rate limiter).
- File extraction outgrows inline `complete` (large PDFs, OCR, transcription).

## Consequences

- No new infrastructure, accounts, or secrets for v2 core orchestration.
- M10 launch readiness must include a restart-during-run drill and an explicit
  accept/defer call on this ADR.
- A future ADR supersedes this one when a trigger fires — it must name the
  trigger and the measured pain, not just the architecture preference.
