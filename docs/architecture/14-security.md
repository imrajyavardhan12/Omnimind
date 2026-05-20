# 14 — Security Architecture

## Goals

OmniMind v2 should protect:

- User accounts.
- Provider API keys.
- Uploaded files.
- Conversations.
- Usage data.
- Billing/cost limits.
- Internal infrastructure.

## Key Security Change

Provider API keys should no longer be stored long-term in browser localStorage.

They should be encrypted and stored server-side.

## Provider Key Vault

### Flow

```txt
1. User enters provider key in settings.
2. Frontend sends key once over HTTPS.
3. Backend validates key with provider.
4. Backend encrypts key using app-level envelope encryption with Infisical-managed root secrets.
5. Backend stores encrypted key and fingerprint.
6. Plaintext key is discarded.
7. Future model calls use decrypted key inside backend only.
```

### Storage

Use Infisical for application secret management.

Provider API keys are stored server-side encrypted using app-level envelope encryption. Encryption root secrets are managed through Infisical.

Do not use AWS Secrets Manager/KMS, Supabase Vault, Google Cloud KMS, or other secret stores for the v2 rebuild unless a future ADR supersedes the platform stack decision.

## Encryption Requirements

Provider keys:

- Never logged.
- Never returned to client.
- Encrypted at rest.
- Decrypted only in memory for provider calls.
- Associated with workspace.
- Revocable.

Store only a fingerprint:

```txt
sk-...abcd
```

or hash for display/debugging.

## Authentication

Use Clerk for OmniMind v2 authentication.

The API verifies Clerk sessions/JWTs and maps Clerk users to internal OmniMind users and workspace memberships.

Required protections:

- Server validates session on every API request.
- Protected routes require auth.
- Workspace membership checked for every workspace resource.
- Role-based permissions added for team features.

## Authorization

Authorization should be workspace-scoped.

Examples:

```txt
owner/admin can manage provider keys
member can create conversations/runs
viewer can read but not execute runs
```

## Rate Limiting

Implement multi-layer limits:

### Edge

Cloudflare:

- IP-based limits.
- WAF.
- bot protection.
- DDoS protection.

### App

Redis-backed limits:

- requests per minute per user.
- chat runs per minute per workspace.
- provider calls per minute.
- file uploads per hour.
- concurrent runs.

## Request Validation

All API inputs must use Zod validation.

Validate:

- max prompt length.
- model count.
- model IDs.
- file IDs belong to workspace.
- max output tokens.
- MIME types.
- file sizes.

## File Security

Files must be:

- Stored private by default.
- Accessed via signed URLs.
- Scoped to workspace.
- MIME allowlisted.
- Size limited.
- Optionally malware scanned.

Never trust browser-provided MIME type alone.

## Prompt Injection and Data Exposure

For future RAG/tools:

- Treat uploaded content as untrusted.
- Separate system instructions from retrieved content.
- Add tool permission checks.
- Require user approval for dangerous tools.
- Audit tool calls.

## Logging Redaction

Never log:

- Provider API keys.
- OAuth tokens.
- Full uploaded file contents.
- Sensitive auth cookies.

Prompt/message logging should be configurable and redacted where needed.

Use structured logs with redaction helpers.

## Audit Logs

Audit key actions:

```txt
provider_key.created
provider_key.deleted
chat_run.created
chat_run.cancelled
file.uploaded
file.deleted
workspace.member.invited
workspace.role.changed
budget.updated
```

Audit logs should include:

- actor user.
- workspace.
- action.
- entity type/id.
- timestamp.
- IP/user agent where available.

## Secrets Management

Application secrets should live in platform secret managers, not `.env` files committed to git.

Required secrets:

```txt
DATABASE_URL
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
CLERK_SECRET_KEY
CLERK_PUBLISHABLE_KEY
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
INFISICAL_CLIENT_ID
INFISICAL_CLIENT_SECRET
PROVIDER_KEY_ENCRYPTION_SECRET
LANGFUSE_SECRET_KEY
SENTRY_DSN
HOSTED_PROVIDER_KEYS if any
```

## Hosted Provider Keys

If OmniMind offers a free/hosted model tier:

- Never expose hosted provider keys to browser.
- Apply strict quota/budget limits.
- Separate hosted-key usage from BYOK usage.
- Add abuse detection.

## Compliance Readiness

Design now for future:

- Data export.
- Account deletion.
- Workspace deletion.
- Conversation deletion.
- File deletion.
- Retention policies.

## Security Tests

Add tests for:

- Workspace isolation.
- Provider key access permissions.
- Missing/invalid auth.
- File access across workspaces.
- Rate limit enforcement.
- Request validation.
- No key returned from provider key APIs.
