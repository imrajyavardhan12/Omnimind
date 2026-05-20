# 23 — Production Launch Checklist

Use this checklist before launching OmniMind v2 to production.

## Architecture

- [ ] Frontend does not directly fan out to providers.
- [ ] Chat runs are backend-orchestrated.
- [ ] Provider calls go through LLM Gateway.
- [ ] Conversations persist in Postgres.
- [ ] Provider keys are encrypted server-side.
- [ ] File payloads are stored in Cloudflare R2.
- [ ] Usage ledger is written for model calls.
- [ ] Council Mode, if enabled, is workflow-backed.

## Security

- [ ] Provider keys are never returned to browser.
- [ ] Provider keys are never logged.
- [ ] Workspace authorization is enforced on every resource.
- [ ] File access is workspace-scoped.
- [ ] Signed URLs expire quickly.
- [ ] Rate limits are enabled.
- [ ] Hosted provider keys have strict quotas.
- [ ] Audit logs exist for sensitive actions.
- [ ] Security headers are configured.
- [ ] Secrets are stored in platform secret manager.

## Data and Migrations

- [ ] Database migrations are versioned.
- [ ] Production migration plan is reviewed.
- [ ] Backups are enabled.
- [ ] Restore process is documented/tested.
- [ ] Soft delete behavior is defined.
- [ ] Retention policy is defined.

## Reliability

- [ ] API health endpoint exists.
- [ ] Worker health checks exist.
- [ ] SSE disconnect behavior is handled.
- [ ] Run cancellation works.
- [ ] Provider timeouts are configured.
- [ ] Provider retries are bounded.
- [ ] Partial model failure is handled.
- [ ] Idempotency prevents duplicate runs.

## Cost Controls

- [ ] Model catalog pricing is current.
- [ ] Usage ledger is verified.
- [ ] Workspace budgets exist.
- [ ] Hosted usage budgets exist.
- [ ] Preflight cost checks exist.
- [ ] Monthly usage dashboard exists.
- [ ] Alerts exist for spend spikes.

## Observability

- [ ] Structured logs are enabled.
- [ ] Request IDs are returned.
- [ ] Sentry is configured.
- [ ] OpenTelemetry traces are configured.
- [ ] LLM traces are configured in Langfuse.
- [ ] Provider latency dashboard exists.
- [ ] Provider error dashboard exists.
- [ ] Cost dashboard exists.
- [ ] Alerts are configured.

## Testing

- [ ] Type-check passes.
- [ ] Lint passes.
- [ ] Unit tests pass.
- [ ] Integration tests pass.
- [ ] Critical E2E tests pass.
- [ ] SSE load test completed.
- [ ] Provider failure tests completed.
- [ ] Workspace authorization tests completed.
- [ ] Provider key vault tests completed.

## UX

- [ ] Empty states are clear.
- [ ] Error messages are actionable.
- [ ] Loading states are per model.
- [ ] Retry/cancel states are visible.
- [ ] Cost/tokens are visible.
- [ ] Mobile layout is usable.
- [ ] Accessibility pass completed.

## Compliance and User Controls

- [ ] User can delete conversations.
- [ ] User can delete files.
- [ ] User can revoke provider keys.
- [ ] User can export conversations.
- [ ] Workspace owner can manage members if teams are enabled.
- [ ] Data deletion behavior is documented.

## Deployment

- [ ] Production environment variables configured.
- [ ] Staging environment validated.
- [ ] Production DB reachable.
- [ ] Redis reachable.
- [ ] Object storage reachable.
- [ ] Worker deployed.
- [ ] Web deployed.
- [ ] API deployed.
- [ ] Cloudflare/WAF configured.
- [ ] Rollback plan exists.

## Runbooks

- [ ] Provider outage runbook exists.
- [ ] Database outage runbook exists.
- [ ] Redis outage runbook exists.
- [ ] Spend spike runbook exists.
- [ ] Bad deployment rollback runbook exists.
- [ ] Security incident runbook exists.

## Final Sign-Off

- [ ] Engineering sign-off.
- [ ] Product sign-off.
- [ ] Security review sign-off.
- [ ] Production smoke test completed.
