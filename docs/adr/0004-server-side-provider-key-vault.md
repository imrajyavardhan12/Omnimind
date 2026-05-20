# ADR 0004 — Store Provider Keys Server-Side

## Status

Accepted

## Context

The MVP stores provider API keys in browser localStorage with client-side encryption/obfuscation. The frontend sends those keys to the app backend on each chat request.

This is acceptable for a prototype but not ideal for production.

## Decision

OmniMind v2 will store provider keys server-side encrypted using app-level envelope encryption with root secrets managed in Infisical.

The browser will send a provider key only when creating/updating it. After validation and encryption, the key will never be returned to the browser.

## Consequences

### Positive

- Better security posture.
- Better BYOK UX across devices.
- Provider calls can happen securely from backend/workers.
- Enables audit logs and key status management.
- Removes need to attach provider keys to every chat request.

### Negative

- Backend becomes responsible for secret handling.
- Requires encryption and Infisical secret-management integration.
- Removes purely local provider key storage from the v2 target architecture.

## Alternatives Considered

### Continue localStorage keys

Rejected as the production default.

### Browser-only provider calls

Rejected because it exposes provider usage patterns, complicates CORS/streaming, prevents centralized accounting, and weakens orchestration.

### Local-only key mode

Rejected for v2. Provider key storage for the v2 rebuild is server-side encrypted storage only.
