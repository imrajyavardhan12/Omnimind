# 13 — Council Mode Workflow

## Goal

Council Mode should become a durable, observable backend workflow instead of a frontend-driven sequence of API calls.

## Why

Council Mode is multi-stage and can take longer than a normal chat request. It should survive:

- Browser reloads.
- Network disconnects.
- Partial model failures.
- Long-running stages.
- Retryable provider errors.

## Inngest

Use Inngest for Council Mode workflows.

Inngest is the v2 workflow engine for Council Mode. Do not introduce Temporal during the v2 rebuild unless a future ADR supersedes the platform stack decision.

## Council Run Stages

```txt
Stage 0: Validate input and create council run
Stage 1: Individual responses
Stage 2: Peer review/ranking
Stage 3: Aggregate rankings
Stage 4: Chairman synthesis
Stage 5: Final report persistence
```

## Stage 1 — Individual Responses

Each council model receives the original query.

Output:

```txt
model response
latency
usage
cost
error if failed
```

Minimum successful responses should be configurable. Recommended default: at least 2.

## Stage 2 — Peer Review

Responses are anonymized before peer review.

Each model receives:

- Original query.
- Anonymized responses A, B, C, etc.
- Ranking criteria.
- Required output format.

Output:

```txt
review text
parsed ranking
confidence/parse status
usage/cost
```

## Stage 3 — Aggregation

The system aggregates rankings.

Possible methods:

- Average rank.
- Borda count.
- Pairwise wins.

Recommended initial method:

```txt
Borda count + average rank
```

Store both raw rankings and aggregate result.

## Stage 4 — Chairman Synthesis

The chairman model receives:

- Original query.
- Ranked responses.
- Summary of peer review.
- Any disagreements.
- Instructions to synthesize final answer.

Output:

```txt
final answer
caveats
cited winning insights
usage/cost
```

## Stage 5 — Final Report

Persist a structured council report.

Report should include:

- Original query.
- Council members.
- Chairman model.
- Individual responses.
- Rankings.
- Aggregate results.
- Final synthesis.
- Usage and total cost.
- Timing.

## Events

Council runs should stream events similar to chat runs:

```txt
council.started
council.stage.started
council.model.started
council.model.completed
council.model.failed
council.ranking.completed
council.aggregate.completed
council.synthesis.delta
council.completed
council.failed
council.cancelled
```

## Persistence

Use:

```txt
council_runs
council_stage_results
usage_ledger
```

Each stage writes durable results.

## Failure Behavior

Council Mode should support partial failure.

Example policy:

- If one model fails in Stage 1 but at least two succeed, continue.
- If chairman fails, retry and then mark final synthesis failed.
- If ranking parsing fails, fallback to heuristic/default ranking but mark parse quality.

## Cancellation

Cancellation should stop pending provider calls and mark workflow as cancelled.

```txt
POST /v1/council/runs/:runId/cancel
```

## Prompt Versioning

Council prompts should be versioned.

Store:

```txt
prompt_template_id
prompt_template_version
rendered_prompt hash
```

This matters because council output quality depends heavily on prompt design.

## Future Enhancements

- Different evaluation criteria per task.
- Expert roles assigned to models.
- Blind vs named review.
- User-defined chairman instructions.
- Judge model independent from council members.
- Re-run only failed stages.
- Compare multiple aggregation strategies.
