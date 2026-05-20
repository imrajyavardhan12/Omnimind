# 21 — Testing Strategy

## Purpose

OmniMind v2 requires confidence in security, provider behavior, streaming, persistence, and cost accounting.

Testing should focus on boundaries and high-risk logic.

## Test Pyramid

```txt
Many unit tests
Some integration tests
Few end-to-end tests
Targeted load/resilience tests
```

## Unit Tests

Prioritize unit tests for:

- LLM Gateway normalization.
- Provider error mapping.
- Token and cost calculation.
- Model capability validation.
- Stream event reducers.
- Council ranking parser.
- Prompt template rendering.
- Permission helpers.
- Environment validation.

## Integration Tests

Prioritize integration tests for:

- API route validation.
- Database repositories.
- Provider key encryption/decryption boundary.
- Chat run creation transaction.
- Usage ledger writes.
- File upload metadata flow.
- Workspace authorization.

Use Testcontainers with PostgreSQL for database integration tests.

## End-to-End Tests

Use Playwright for critical paths:

1. User logs in.
2. User creates provider key.
3. User starts single chat.
4. User starts compare run.
5. User cancels run.
6. User uploads a file.
7. User views usage dashboard.

E2E tests should use mocked/fake provider responses where possible to avoid cost and flakiness.

## Provider Testing

Do not rely entirely on live provider APIs.

Use:

- Mock provider streams.
- Recorded fixtures where safe.
- Contract tests for adapter behavior.
- Optional live smoke tests gated by env vars.

Live provider tests should be opt-in:

```txt
RUN_LIVE_PROVIDER_TESTS=true
```

## Streaming Tests

Test:

- ordered events
- multiple model deltas
- model failure while others continue
- cancellation
- retry event emission
- client disconnect handling
- malformed provider stream chunks

## Security Tests

Test:

- unauthenticated API access rejected
- user cannot access another workspace's conversation
- user cannot access another workspace's file
- provider key plaintext is not returned
- provider key APIs require admin/owner role
- rate limits trigger correctly

## Cost Tests

Test:

- provider-reported usage converted correctly
- estimated usage fallback
- cost calculation uses model catalog
- usage ledger is written once per completed model run
- failed model runs do not incorrectly charge unless provider usage is known

## Migration Tests

When migrating localStorage conversations:

- valid legacy sessions import
- malformed sessions are skipped safely
- attachments with missing base64 are handled
- duplicate imports are prevented

## Load/Resilience Tests

Before production launch, test:

- many concurrent SSE connections
- slow provider stream
- provider timeout
- provider 429 burst
- Redis unavailable behavior
- database connection pool exhaustion
- worker retry behavior

## Tooling

Use exactly:

```txt
Unit/integration: Vitest
E2E: Playwright
HTTP tests: native fetch against the Hono test server
DB tests: Testcontainers with PostgreSQL
Mocking: MSW for browser/API mocks and a custom fake provider server for LLM streams
```

## CI Requirements

CI should run:

```txt
type-check
lint
unit tests
integration tests where practical
build
```

Live provider tests should not run in normal CI.

## Test Data

Use factories for:

- users
- workspaces
- conversations
- messages
- chat runs
- model runs
- files
- provider keys

Avoid copy-pasted test setup.

## Acceptance for Critical Features

Critical features require tests before considered complete:

- Provider key vault.
- Chat run engine.
- LLM Gateway.
- Usage ledger.
- Workspace authorization.
- File access.
- Council ranking parser.
