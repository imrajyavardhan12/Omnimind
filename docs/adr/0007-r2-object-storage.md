# ADR 0007 — Cloudflare R2 for File Object Storage

## Status

Accepted

## Context

M7 introduces the file and multimodal pipeline. The MVP stored file payloads as
base64 in browser state / localStorage, which does not scale, leaks large payloads
into message bodies, and cannot be secured or audited.

`docs/architecture/12-file-pipeline.md`, `10-data-model.md`, and `14-security.md`
all already specify Cloudflare R2 as the object store, with Postgres holding only
metadata and R2 object keys. `docs/adr/0006-definitive-v2-platform-stack.md` lists
R2 in the platform stack.

R2 is a **new infrastructure provider**, which is a stop condition under
`docs/master-rebuild-plan.md` §18. This ADR records the decision and the operating
choices made before any R2/worker code is written.

## Decision

OmniMind v2 will use **Cloudflare R2** (S3-compatible object storage) as the
durable store for uploaded files and extracted artifacts.

Operating choices for the first slice (M7):

1. **R2 is the object store.** Buckets are **private**; no public buckets. Clients
   never read or write R2 directly except through **short-expiry signed URLs**
   issued by the API (signed PUT to upload, signed GET to download). This is the
   M7B integration; M7A persists metadata and stubs the signed URL.

2. **Secrets are env-validated via `packages/config`, following the established M2
   pattern — not a live Infisical integration.** `14-security.md` names Infisical as
   the eventual secret manager, but the project's de-facto pattern (M2's
   `PROVIDER_KEY_ENCRYPTION_SECRET`) is a Zod-validated environment variable in
   `apiEnvSchema`. The R2 credentials (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
   `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT`) follow the same pattern and
   are operator-supplied into `apps/api/.env.local`. Wiring a real Infisical client
   remains a future, separate decision (it would supersede this only for *how*
   secrets are sourced, not *which* store is used). R2 keys are never logged and
   never returned to the browser.

3. **Extraction runs inline in the API for the first slice, not on a queue.**
   `apps/worker` stays a skeleton. The MIME-specific text extractor
   (pdf/docx/txt/md/csv/json) runs synchronously inside `POST /v1/files/:id/complete`
   in M7C. Standing up a real queue + worker consumer is a heavier change with its
   own infrastructure and **will be its own ADR** when extraction cost/latency
   demands it. We deliberately do **not** introduce Redis, a queue, or
   virus/malware scanning in M7 just because the architecture docs mention them.

## Phasing

| Slice | Scope | R2 needed? |
|-------|-------|------------|
| M7A | `files` / `file_extractions` / `message_attachments` tables + repos + migration + `/v1/files/*` routes with MIME allowlist, size/quota limits. Upload URL **stubbed**. | No |
| M7B | S3-compatible R2 client; real short-expiry signed PUT/GET; `complete` verifies the object + records `sha256`. | Yes (creds) |
| M7C | Inline MIME extraction → `extracted_text`; `status` → `ready`/`failed`. | Yes |
| M7D | Composer uploads **before** run creation → `attachmentIds`; LLM Gateway prepares per-model attachment payloads; `message_attachments` links. | Yes |

## Consequences

### Positive

- Files are durable and storage-efficient; Postgres stays lean (metadata + keys).
- Private buckets + signed URLs + workspace scoping give a defensible security model.
- Inline extraction keeps the first slice small and reviewable; no premature queue infra.
- Env-validated secrets match the existing, working M2 pattern — no new secret-manager
  surface area mid-milestone.

### Negative

- Adds an external infra dependency (Cloudflare R2) and its credentials to operate.
- Inline extraction blocks the `complete` request for the extraction duration and does
  not survive an API restart mid-extraction; acceptable for the first slice, revisited
  when a queue ADR lands.
- Deviates from `14-security.md`'s Infisical wording for secret sourcing (documented
  above); reconciled when/if a real Infisical integration is adopted.

## Alternatives Considered

### AWS S3 / GCS

Rejected: `0006-definitive-v2-platform-stack.md` fixes the platform on Cloudflare
R2. R2 has no egress fees and an S3-compatible API, so the client is portable if this
is ever revisited.

### Store files in Postgres (bytea) or keep base64 in messages

Rejected: the exact MVP anti-pattern M7 exists to remove. Bloats the canonical store,
breaks streaming/payload sizes, and is unauditable.

### Queue-based extraction from day one

Deferred, not rejected. Inline-first is simpler and meets the M7 exit criteria. A queue
becomes warranted when extraction is slow/expensive enough to harm request latency, at
which point it gets its own ADR (queue choice + worker run model).

---

## Operator Setup — creating R2 credentials (for M7B)

Do this in the Cloudflare dashboard (you said you've signed up). M7A needs none of
this; have it ready before M7B.

1. **Enable R2** — Cloudflare dashboard → **R2 Object Storage** → enable (a payment
   method is required even on the free tier; the free tier covers 10 GB storage and
   generous Class A/B operations).

2. **Create a bucket** — R2 → **Create bucket**.
   - Name: e.g. `omnimind-files` (dev) — this becomes `R2_BUCKET`.
   - Location: **Automatic** is fine. Keep it **private** (the default). Do **not**
     enable public access / a public r2.dev domain.

3. **Get the Account ID** — on the R2 overview page, copy **Account ID** →
   this is `R2_ACCOUNT_ID`. The S3 endpoint is then:
   `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com` → `R2_ENDPOINT`.

4. **Create an S3 API token (access key pair)** — R2 → **Manage R2 API Tokens** →
   **Create API token**.
   - Permissions: **Object Read & Write** (not Admin).
   - Scope: **Apply to specific buckets only** → select `omnimind-files`.
   - TTL: your choice (a long-lived token is fine for dev; rotate for prod).
   - On create, Cloudflare shows an **Access Key ID** and a **Secret Access Key**
     **once**. Copy both now:
     - Access Key ID → `R2_ACCESS_KEY_ID`
     - Secret Access Key → `R2_SECRET_ACCESS_KEY`

5. **Put them in `apps/api/.env.local`** (never commit this file):

   ```bash
   R2_ACCOUNT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   R2_ACCESS_KEY_ID=xxxxxxxxxxxxxxxxxxxx
   R2_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   R2_BUCKET=omnimind-files
   R2_ENDPOINT=https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com
   ```

   `.env.example` will document these in M7B. The API will fail fast at boot if any
   are missing once R2 is wired (Zod `apiEnvSchema`).

6. **(Optional, M7B) CORS on the bucket** — for direct browser → R2 PUT uploads,
   add a bucket CORS policy allowing the web origin (`http://localhost:3000`) with
   `PUT`, `GET` and the headers the signed URL requires. The M7B agent will provide
   the exact JSON.
