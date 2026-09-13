Phase/Milestone: M7A — File schema + file APIs (R2 stubbed) (2026-06-04)

Summary:
M7A lands the durable, workspace-scoped file foundation for the M7 file/multimodal
pipeline WITHOUT yet introducing Cloudflare R2. Three new tables (files /
file_extractions / message_attachments), a FileRepository, shared Zod types + a MIME
allowlist + size/quota limits, and the four `/v1/files/*` routes are in place. The
upload URL is a deliberate STUB (`stub://...`, `stub: true`) until R2 is wired in M7B.
Branch: `m7a-file-schema-apis` (off main; NOT committed — left for review per the
operator's "M7A only, then review" choice).

Stop-and-confirm (master-rebuild-plan §18 — new infra provider):
  R2 is a new infra provider, so building paused for operator confirmation first.
  Operator decisions (locked):
    1. R2 IS the object store → ADR 0007 written. Operator has a Cloudflare signup;
       the ADR includes a step-by-step credential-creation guide (for M7B).
    2. Extraction runs INLINE in the API for the first slice (no queue);
       apps/worker stays a skeleton. A queue is a later, separate ADR.
    3. Scope this pass = M7A only (schema + file APIs, R2 stubbed), then review.
  Secrets follow the established env-validated `packages/config` pattern (like M2's
  PROVIDER_KEY_ENCRYPTION_SECRET), NOT a live Infisical client — documented in ADR 0007
  as a deviation from 14-security.md's Infisical wording. No Redis / queue / virus
  scanning introduced (explicitly out of scope).

Files changed (18 files, +2885 / -5; the big diff is the drizzle snapshot):

  packages/db
    NEW   src/schema/files.ts                        files, file_extractions,
            message_attachments tables + indexes; FileRecord/NewFileRecord etc. (the
            select/insert types are named *FileRecord* to avoid clashing with the DOM
            `File` global).
    UPD   src/schema/index.ts                         export ./files.js
    NEW   src/repositories/file.repository.ts         FileRepository: create, findById
            (workspace-scoped, excludes deleted), updateStatus, softDelete (status=deleted
            + deleted_at), sumActiveSizeBytes (quota).
    UPD   src/index.ts                                export FileRepository
    NEW   src/repositories/__tests__/file.repository.test.ts   8 tests (create/find/
            update/softDelete true+false/sum coercion+zero)
    NEW   migrations/0004_lucky_yellow_claw.sql       3 CREATE TABLE + 5 FK + 3 index
            (purely additive). APPLIED to Neon + verified live (files=15 cols,
            file_extractions=9, message_attachments=5; all indexes present).
    UPD   migrations/meta/*                            journal + 0004 snapshot

  packages/types
    NEW   src/api/files.ts                            ALLOWED_MIME_TYPES (image/text/pdf/
            docx/audio) + isAllowedMimeType/fileCategoryForMime; MAX_FILE_SIZE_BYTES (25MB),
            MAX_FILES_PER_MESSAGE (10), MAX_TOTAL_BYTES_PER_MESSAGE (50MB),
            DEFAULT_WORKSPACE_STORAGE_QUOTA_BYTES (5GB); createUploadRequest/Response,
            fileStatus, fileResponse schemas.
    UPD   src/api/errors.ts                            +QUOTA_EXCEEDED, FILE_TOO_LARGE,
            UNSUPPORTED_MEDIA_TYPE
    UPD   src/index.ts                                 export the file types/constants

  apps/api
    NEW   src/routes/files.ts                          POST /uploads (viewer 403 → Zod →
            MIME allowlist 415 → size 413 → quota 413 → create pending row + stubbed
            uploadUrl, 201); POST /:id/complete (404 / pending→uploaded / idempotent +
            audit file.uploaded); GET /:id (metadata DTO, no storage key, 404);
            DELETE /:id (viewer 403 / soft delete / 404 + audit file.deleted).
    UPD   src/index.ts                                 wire v1.route('/files', ...)
    NEW   src/routes/__tests__/files.test.ts           14 tests (viewer 403; 400/415/413
            FILE_TOO_LARGE/413 QUOTA; 201 + pending row; complete 404/transition/idempotent;
            get 404/metadata-only; delete 403/404/ok+audit)

  docs
    NEW   docs/adr/0007-r2-object-storage.md           the decision + M7 phasing table +
            operator R2 credential-setup guide
    UPD   docs/architecture/10-data-model.md           files status lifecycle (+pending,
            +deleted_at, bigint size_bytes), extraction_type +passthrough
    UPD   docs/architecture/11-api-design.md           upload response method/stub + the
            new file error codes
    UPD   docs/architecture/12-file-pipeline.md         M7 inline-extraction decision note
    NEW   docs/handoff-m7a.md                           this file

Validation:
  - pnpm type-check (turbo) : PASS (9/9 packages)
  - pnpm lint               : PASS (no warnings or errors)
  - pnpm test               : PASS (151 total; +22 new: 8 file repo, 14 file routes)
  - pnpm build              : PASS (api tsc + web next build, 2/2)
  - migration 0004          : generated + APPLIED to Neon + verified live (tables/indexes)
  Not committed — branch left for review.

Key design decisions:
  1. Upload URL is stubbed (`stub://r2/<bucket>/<key>`, `stub: true`). M7A is contract +
     validation + persistence only; M7B issues the real short-expiry signed PUT.
  2. `POST /:id/complete` is idempotent: pending → uploaded; already-past-pending returns
     as-is. M7B will verify the R2 object + record sha256; M7C runs inline extraction.
  3. Storage key = `workspaces/<wsId>/files/<fileId>/<sanitized-filename>` (allowlist
     sanitizer keeps [A-Za-z0-9._-], so a filename can't escape its prefix). Bucket is a
     placeholder const today; M7B injects R2_BUCKET from env.
  4. Limits enforced at upload: per-file 25MB (FILE_TOO_LARGE) + MIME allowlist
     (UNSUPPORTED_MEDIA_TYPE) + workspace quota 5GB (QUOTA_EXCEEDED). The per-MESSAGE
     limits (10 files / 50MB) are defined as constants but enforced later at run creation
     (M7D), since that is when attachments attach to a message.
  5. GET returns a curated DTO (id/filename/mimeType/sizeBytes/status/sha256/timestamps) —
     never storage_bucket/storage_key. Tests assert the storage key never leaks.
  6. Writes (upload/complete/delete) are viewer-gated (403), mirroring chat-runs; GET is
     allowed for all roles. Audit: file.uploaded (on complete), file.deleted (on delete).
  7. file_extractions + message_attachments tables ship now (one coherent migration) but
     have NO repos yet — they are written by their consumers in M7C (extraction) and M7D
     (message↔file linking). FileRepository is the only file repo M7A needs.

Architecture / guardrail compliance:
  - No base64 file payloads anywhere; Postgres holds metadata + R2 object keys only.
  - Workspace-scoped access on every route; private-by-default storage model (no public
    buckets); MIME allowlist + size/quota limits (14-security.md / 12-file-pipeline.md).
  - Provider-attachment logic NOT added to routes/React (that's the LLM Gateway, M7D).
  - Stack unchanged: pnpm/Turborepo, Hono, Neon + Drizzle, Clerk. Nothing new introduced
    in M7A (R2 client, Redis, queue, virus scanning all deferred).
  - Shared Zod contracts in @omnimind/types; stable error codes; repository/route boundary.

Known gaps / deferred (by design):
  - R2 NOT wired: uploadUrl is a stub; nothing is actually stored in object storage yet.
    `complete` cannot verify an object or compute sha256 until M7B.
  - No extraction yet: file_extractions is empty; files never reach `processing`/`ready`
    in M7A (they stop at `uploaded`). M7C adds inline extraction.
  - No composer/gateway wiring: createRunRequestSchema.input.attachmentIds is STILL a
    no-op (accepted + ignored by the run engine — confirmed by grep). M7D threads it.
  - No object-deletion on soft delete (status=deleted + deleted_at only); a retention
    cleanup job removes R2 objects later.
  - messages.modelRunId / message_attachments have no FK enforcement beyond what drizzle
    generated; message_attachments has FKs to messages + files.

Operator action before M7B:
  Provision R2 + create credentials using the guide in docs/adr/0007-r2-object-storage.md
  ("Operator Setup"). Have R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY /
  R2_BUCKET / R2_ENDPOINT ready for apps/api/.env.local. M7A needs none of these.

Next recommended task: M7B — R2 integration
  - New S3-compatible R2 client (packages/storage or within an existing package); add
    R2_* to apiEnvSchema (packages/config) + .env.example; real short-expiry signed PUT
    (replace the stub) + signed GET for downloads; `complete` verifies the object + records
    sha256 → status uploaded; bucket CORS for direct browser→R2 PUT. Then M7C (inline
    extraction) and M7D (composer upload-before-run + LLM Gateway attachment prep).
  (Operator deferred, still open: #1 cancel-persistence backend fix; stale OpenRouter
   catalog slugs; Council on the legacy path until M8.)

Docs updated: docs/handoff-m7a.md (this), docs/adr/0007-r2-object-storage.md (new),
docs/architecture/10-data-model.md, 11-api-design.md, 12-file-pipeline.md.
