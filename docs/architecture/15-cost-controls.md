# 15 — Cost Controls and Rate Limiting

## Why This Matters

AI applications can incur large costs quickly. OmniMind is especially sensitive because compare mode fans one user prompt out to multiple providers/models.

Cost controls must be designed as core infrastructure.

## Cost Control Layers

```txt
Edge limits
  → API rate limits
  → Workspace quotas
  → Provider call limits
  → Model-specific constraints
  → Monthly/daily budgets
  → Usage ledger
```

## Usage Ledger

Every model call should write a usage ledger entry.

Fields:

```txt
workspace_id
user_id
provider
model
input_tokens
output_tokens
total_tokens
cost_usd
usage_source
chat_run_id
chat_model_run_id
created_at
```

This supports:

- Usage dashboards.
- Budget enforcement.
- Billing.
- Abuse detection.
- Model comparison reports.

## BYOK vs Hosted-Key Usage

Track separately:

```txt
usage_source_type: byok | hosted
```

BYOK usage costs the user at their provider, but OmniMind should still estimate/display costs.

Hosted-key usage costs OmniMind directly and must have stricter quotas.

## Budget Types

Recommended:

```txt
workspace_daily_budget_usd
workspace_monthly_budget_usd
hosted_model_monthly_budget_usd
user_daily_run_limit
concurrent_run_limit
```

## Rate Limits

Use Upstash Redis.

Suggested limits:

### Per User

```txt
chat runs per minute
messages per hour
file uploads per hour
prompt enhancements per hour
```

### Per Workspace

```txt
provider calls per minute
concurrent runs
monthly hosted usage
storage quota
```

### Per IP

```txt
login attempts
signup attempts
public endpoint requests
```

## Model Limits

Model registry should define:

```txt
max_output_tokens
context_window
supports_streaming
input_cost_per_1m
output_cost_per_1m
```

The API should reject impossible requests before provider calls.

## Preflight Cost Estimation

Before executing a run:

1. Estimate input tokens from context + prompt + files.
2. Estimate max possible output tokens.
3. Estimate max cost across selected models.
4. Check against budget.

This avoids accidentally launching expensive runs.

## Context Controls

Allow configurable context policy:

```txt
all messages
last N messages
summarized context
manual selected context
```

Default should not be unlimited context for compare mode.

Recommended default:

```txt
last 20 messages or token-budgeted context
```

## Provider Retries and Cost

Retries can increase cost if the provider completes but the network fails before response handling.

Rules:

- Retry only clearly safe cases.
- Avoid retrying after output has started unless explicitly supported.
- Track retry attempts.
- Surface retry status to UI.

## Abuse Prevention for Hosted Tier

If offering free hosted Google AI Studio or other hosted access:

- Require authenticated users.
- Add daily message limits.
- Add model-specific max output tokens.
- Add content abuse monitoring.
- Add IP and account velocity checks.
- Disable hosted access for suspicious accounts.

## Dashboard Requirements

Usage dashboard should show:

- Total cost by date range.
- Cost by provider/model.
- Tokens by provider/model.
- Average latency by model.
- Error rates.
- Hosted vs BYOK usage.
- Top conversations by cost.

## Alerts

Add alerts for:

- Workspace crosses 80% monthly budget.
- Hosted-key spend spikes.
- Provider error rate spikes.
- Abnormally high file upload volume.
- Repeated failed provider auth.

## Initial Defaults

Suggested initial defaults:

```txt
Max models per compare run: 5
Max concurrent runs per user: 2
Max prompt text length: 50k chars
Max output tokens per model: model-specific, capped by plan
Default context: token-budgeted last messages
Hosted free tier: strict daily limits
```

## Cost Calculation

Use model catalog pricing, not hardcoded provider files.

Pricing source:

```txt
model_catalog.input_cost_per_1m
model_catalog.output_cost_per_1m
```

Calculation:

```txt
cost = input_tokens / 1_000_000 * input_cost_per_1m
     + output_tokens / 1_000_000 * output_cost_per_1m
```

Store cost as decimal/string, not floating point when exact accounting matters.
