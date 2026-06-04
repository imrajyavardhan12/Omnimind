Start prompt — M7: File and Multimodal Pipeline

CURRENT STATE (2026-06-04):
- origin/main @72b1284. M0–M6.5 complete + merged. In place: persistence + auth (M1),
  provider key vault (M2), model catalog (M3), LLM Gateway (M4), chat run engine (M5),
  and a clean single+compare frontend on backend runs (M6/M6.5 — RunChatView is the only
  single/compare path; backend-wired sidebar; owned ChatMarkdown renderer; legacy dual-path
  removed).
- THE RUN-SIDE HOOK FOR FILES ALREADY EXISTS: createRunRequestSchema accepts
  input.attachmentIds (uuid[]). M7 builds the pipeline that produces those ids; the run
  engine already threads them.
- apps/worker is an M0 skeleton (not implemented). No file tables yet.

READING MODE: BOOTSTRAP-lite (new milestone, new infra). Read, in order:
  AGENTS.md · docs/handoff-m6.5.md (entry state) · docs/master-rebuild-plan.md §12 (M7)
  Task docs (read 12 fully):
    docs/architecture/12-file-pipeline.md    — the spec
    docs/architecture/14-security.md         — file access, signed URLs, MIME allowlist
    docs/architecture/10-data-model.md       — files / file_extractions / message_attachments
    docs/architecture/11-api-design.md        — /v1/files/* endpoints
    docs/architecture/08-llm-gateway.md       — provider-specific attachment prep
  Inspect: packages/db/src/schema (no files tables yet) · apps/worker (skeleton) ·
  packages/types (createRunRequestSchema.input.attachmentIds) · apps/api routes/middleware ·
  packages/config (env/secret pattern) · handoff-m5b.md (db.batch atomics, neon-http).

>>> STOP-AND-CONFIRM BEFORE BUILDING (master-rebuild-plan §18) <<<
  M7 introduces Cloudflare R2 — a NEW INFRASTRUCTURE PROVIDER, and possibly a worker
  queue. Per §18 (a new infra provider is a stop condition) confirm with the operator
  BEFORE writing R2/worker code:
   1. R2 is the chosen object store; write docs/adr/0007-r2-object-storage.md.
   2. R2 is provisioned + credentials available (operator-supplied like M2/M5C secrets:
      account id, access key id, secret, bucket, endpoint) — wire via packages/config.
   3. How apps/worker runs (local + prod) and whether extraction is a queued worker job
      or runs INLINE in the API for the first slice (prefer inline/simple first; a queue
      = its own decision/ADR).
  Do not introduce Redis/a queue/virus-scanning just because the doc mentions them — scope
  the first slice small.

OBJECTIVE (master-rebuild-plan §12):
  Durable, secure, model-aware files. NOT base64 in messages; Postgres holds metadata +
  R2 object keys; the composer uploads BEFORE run creation and submits attachmentIds; the
  LLM Gateway prepares model-specific attachment payloads.

SUGGESTED PHASING (reviewable slices, like M5 A/B/C):
  M7A — Schema + file APIs (R2 stubbed/local first):
    - files + file_extractions + message_attachments tables (10-data-model.md) + repos +
      migration (generate; apply like M5A/B). Workspace-scoped.
    - POST /v1/files/uploads (validate filename/mime/size/quota -> files row status=pending
      -> return signed upload URL + fileId) · POST /v1/files/:id/complete · GET /v1/files/:id
      · DELETE /v1/files/:id. Shared Zod in @omnimind/types. Stable error codes.
    - MIME allowlist + limits (12-file-pipeline.md: 25MB/file, 10/msg, 50MB total).
  M7B — R2 integration (AFTER the §18 confirm + ADR):
    - S3-compatible R2 client (new packages/storage or within an existing package).
    - Real signed PUT URLs (short expiry); client uploads direct to R2; complete -> mark ready.
    - Secrets via packages/config; never log keys; no public buckets.
  M7C — Extraction:
    - Extractor by MIME: pdf text, docx text, txt/md/csv/json passthrough; images store +
      optional thumbnail; audio later. Store extracted text (files.extracted_text_key or R2);
      files.status -> ready/failed. Start INLINE/simple; queue is a later decision.
  M7D — Composer + gateway wiring:
    - Composer (features/chat): upload BEFORE run creation -> attachmentIds in CreateRunRequest;
      upload progress = UI state only (no base64 in messages/localStorage). Follow 06b-frontend-standards.
    - LLM Gateway (@omnimind/ai): per model, prepare attachment payload (vision+image -> image;
      non-vision -> OCR/extracted text; doc -> extracted text; truncate/chunk large text).
      08-llm-gateway.md + 12-file-pipeline.md "Provider Preparation". Link messages<->files via
      message_attachments.

EXIT CRITERIA (master-rebuild-plan §12):
  - Files are NOT stored as canonical base64 message payloads.
  - Images can be used by vision models.
  - Text/PDF extraction works minimally.
  - File access is workspace-scoped (auth + ownership; signed URLs short-lived; no public buckets).

GUARDRAILS:
  - 14-security.md: authenticated + workspace-scoped access; MIME allowlist; size limits;
    short-expiry signed URLs; no public R2 buckets; virus scanning = later.
  - No base64 file payloads in messages or localStorage; provider attachment logic in the
    LLM Gateway, not React/routes; db.batch atomics (neon-http, no interactive tx).
  - Update 10/11/12 docs if shapes change; ADR for R2 (0007) and for any queue choice.
  - Small reviewable steps; branch off main; do NOT commit to main directly; gates
    (type-check/lint/test/build) green per slice; tests for upload validation + extraction.

KNOWN DEFERRED (operator chose M7 with these open):
  - #1 cancel-persistence backend fix — docs/prompts/start-cancel-persistence-fix-agent-prompt.md
  - stale OpenRouter catalog slugs (re-sync; needs M3 /v1/models/sync)
  - Council on the legacy path until M8 (then delete the MarkdownRenderer shim + legacy stores)
