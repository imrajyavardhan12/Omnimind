# Security Policy

## Supported versions

OmniMind v2 is pre-1.0 and under active rebuild. Security fixes land on `main`
and are noted in release notes. There are no LTS branches yet.

| Version | Supported |
|---|---|
| `main` (v2 rebuild) | ✅ |
| MVP-era tags / forks | ❌ best-effort only |

## Reporting a vulnerability

**Do not open a public issue for a suspected vulnerability.**

Email the maintainer privately (see GitHub profile) or use GitHub's
**Private vulnerability reporting** on this repo. Include:

- Affected route / commit / version
- Reproduction steps (redact real keys)
- Impact assessment (key leak? cross-workspace access? spend abuse?)
- Any logs with secrets **redacted**

Expect an acknowledgement within 72 hours. We will coordinate a fix and a
disclosure timeline with you before anything goes public.

## Security model (what we promise)

- **Provider keys:** AES-256-GCM encrypted at rest (`provider_keys.encrypted_key`),
  root secret via `PROVIDER_KEY_ENCRYPTION_SECRET` (Infisical-managed in prod).
  Plaintext keys are never returned by any API, never logged, decrypted only in
  memory for provider calls. Only `owner`/`admin` roles may write keys.
- **AuthN/Z:** Clerk sessions verified on every API request; every resource query
  is workspace-scoped; `viewer` role is read-only (cannot create runs or write keys/files).
- **Files (M7+):** private Cloudflare R2 buckets only; short-expiry signed URLs;
  MIME allowlist + per-file (25 MB) and per-message (10 files / 50 MB) limits +
  workspace quota (5 GB default); storage keys never leak through `GET /v1/files/:id`.
- **Transport:** HTTPS everywhere in staging/prod; `Idempotency-Key` on run creation;
  CORS allowlist includes any custom header we introduce.
- **Audit:** key writes, run cancellations, file upload completion/deletion are
  audit-logged with actor + workspace + entity.

## Out of scope (known pre-launch gaps)

Tracked in `docs/architecture/23-launch-checklist.md` and `docs/architecture/24-risk-register.md`:
M9 observability/rate-limit hardening, hosted-key spend guardrails, and load tests
are not yet complete. Do not deploy `main` to production with real hosted keys
until M10 sign-off.

## Safe-harbor

Good-faith research against your own workspace with your own keys is welcome.
Do not access other users' workspaces, exfiltrate data, or degrade the service.
