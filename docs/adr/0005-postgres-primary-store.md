# ADR 0005 — Use Neon Postgres as the Primary System of Record

## Status

Accepted

## Context

The MVP stores much of the application state in browser localStorage. This prevents durable cross-device history, reliable usage accounting, team features, audit logs, and backend workflows.

OmniMind needs a strong transactional database for conversations, messages, runs, provider key metadata, usage, files, and audit logs.

## Decision

Use Neon Postgres as the primary system of record.

Use Upstash Redis only for ephemeral/cache concerns, not canonical application data.

## Consequences

### Positive

- Durable conversations.
- Cross-device support.
- Strong relational model.
- Good audit and usage ledger support.
- Can add pgvector later for RAG.
- Mature ecosystem.

### Negative

- Requires schema/migrations.
- Requires backend APIs for persistence.
- Local-first behavior requires explicit offline/draft design.

## Alternatives Considered

### Continue localStorage

Rejected because it is not production-grade for canonical data.

### NoSQL document store

Rejected because relational data fits conversations, runs, usage, files, and workspaces well.

### Dedicated vector database as primary store

Rejected. Vector search may be added later, but it should not be the primary application database.
