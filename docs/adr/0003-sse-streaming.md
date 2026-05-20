# ADR 0003 — Use SSE for Chat Run Streaming

## Status

Accepted

## Context

OmniMind needs to stream text from one or more models to the browser. Most stream traffic is server-to-client.

The MVP uses provider streams indirectly and frontend code parses streaming chunks in multiple places.

## Decision

Use Server-Sent Events, or SSE, as the primary streaming transport for chat and council run events.

Each user prompt creates one backend run and one client stream carrying events for all model responses.

## Consequences

### Positive

- Simpler than WebSockets.
- Works well with HTTP infrastructure.
- Good fit for one-way token streaming.
- Easier to debug.
- Supports typed event names.
- Reduces multiple parallel browser streams.

### Negative

- Not ideal for bidirectional real-time collaboration.
- Requires separate endpoint for cancellation/control messages.
- Reconnection/replay needs explicit design.

## Alternatives Considered

### WebSockets

Deferred. Useful later for multi-user collaboration, presence, and interactive tool approval.

### Long polling

Rejected because token streaming requires low-latency incremental updates.

### Provider streams directly to browser

Rejected because provider keys and provider-specific event formats should not reach the browser.
