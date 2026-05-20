# OmniMind Production Runbooks

This document contains initial production runbooks for OmniMind v2.

These should be expanded as implementation details become concrete.

## Runbook: Provider Outage

### Symptoms

- Spike in provider 5xx errors.
- Provider timeout alerts.
- Many model runs failing for one provider.

### Immediate Actions

1. Check provider status page.
2. Check provider-specific error dashboard.
3. Disable affected model/provider in model catalog if needed.
4. Enable fallback models if configured.
5. Communicate user-facing degradation if severe.

### Follow-Up

- Review retry/circuit breaker behavior.
- Check cost impact.
- Add incident note.

## Runbook: Provider Rate Limits

### Symptoms

- Spike in 429 errors.
- Model runs stuck retrying.
- Increased latency.

### Immediate Actions

1. Confirm which provider/model is rate-limited.
2. Reduce concurrency for that provider.
3. Enable backoff/circuit breaker.
4. Notify users with clear per-model error.
5. Consider fallback model if allowed.

### Follow-Up

- Adjust provider concurrency limits.
- Review usage spike source.

## Runbook: Hosted Spend Spike

### Symptoms

- Hosted provider cost alert fires.
- Unusual request volume.
- High usage from one workspace/user/IP.

### Immediate Actions

1. Identify top usage sources.
2. Temporarily reduce hosted quota.
3. Disable abusive account/workspace if needed.
4. Rotate hosted provider key if compromised.
5. Preserve logs for investigation.

### Follow-Up

- Add missing rate limits.
- Improve anomaly detection.
- Review budget thresholds.

## Runbook: Database Outage

### Symptoms

- API 5xx errors.
- DB connection failures.
- High query latency.

### Immediate Actions

1. Check database provider status.
2. Check connection pool saturation.
3. Scale database if applicable.
4. Temporarily disable heavy endpoints if needed.
5. Keep status page/user messaging updated.

### Follow-Up

- Inspect slow queries.
- Add indexes if needed.
- Review connection pool settings.

## Runbook: Redis Outage

### Symptoms

- Rate limits failing.
- Cancellation issues.
- Idempotency/caching degraded.

### Immediate Actions

1. Check Redis provider status.
2. Decide fail-open vs fail-closed per feature:
   - auth/security limits should fail closed where possible
   - noncritical caches can fail open
3. Restart affected services if connection recovery fails.

### Follow-Up

- Review Redis dependency behavior.
- Add fallback behavior for noncritical cache.

## Runbook: Bad Deployment

### Symptoms

- Error rate spike after deploy.
- Broken chat runs.
- Frontend runtime errors.

### Immediate Actions

1. Confirm deploy version.
2. Roll back web/API/worker as appropriate.
3. Check migrations; do not blindly rollback destructive migrations.
4. Verify health endpoints.
5. Run smoke test.

### Follow-Up

- Add missing test coverage.
- Write incident review if user impact occurred.

## Runbook: Security Incident

### Symptoms

- Suspicious API usage.
- Provider key exposure suspected.
- Unauthorized workspace access suspected.

### Immediate Actions

1. Preserve logs.
2. Revoke/rotate affected secrets.
3. Disable affected account/workspace if needed.
4. Identify blast radius.
5. Notify stakeholders according to policy.

### Follow-Up

- Patch vulnerability.
- Add regression tests.
- Review audit logs.
- Update security documentation.

## Runbook: File Processing Backlog

### Symptoms

- Files stuck in processing.
- Worker queue grows.
- Extraction failures spike.

### Immediate Actions

1. Check worker status.
2. Check Cloudflare R2 access.
3. Check extraction dependency health.
4. Scale workers if needed.
5. Requeue failed jobs if safe.

### Follow-Up

- Add file size/type constraints if needed.
- Improve extraction error messages.
