# 22 — Product and UX Principles

## Product Feel

OmniMind v2 should feel like a professional AI command center, not just a multi-panel chatbot.

The experience should communicate:

- control
- trust
- clarity
- speed
- comparison
- cost awareness
- model intelligence

## Core UX Promise

```txt
Ask once. Compare intelligently. Trust what happened.
```

## UX Principles

## 1. Make Orchestration Visible

When multiple models are running, users should understand what is happening.

Show states:

```txt
Queued
Starting
Streaming
Retrying
Completed
Failed
Cancelled
```

Avoid vague loading states.

## 2. Partial Failure Should Feel Normal

In a multi-provider system, one model failing should not make the whole product feel broken.

Example:

```txt
Claude was rate limited and retried twice.
GPT-4o and Gemini completed successfully.
```

## 3. Cost Should Be Visible, Not Scary

Show estimated and actual cost clearly.

Before run:

```txt
Estimated max cost: $0.03
```

After run:

```txt
Total cost: $0.018
```

## 4. Compare Mode Should Compare

Do not only display side-by-side text.

Also show:

- latency
- token usage
- cost
- model status
- user rating
- best answer marker
- synthesize option

## 5. Council Mode Should Feel Like a Report

Council output should feel structured and valuable.

Show:

- independent answers
- peer rankings
- aggregate winner
- disagreements
- chairman synthesis
- total cost/time

## 6. Settings Should Build Trust

Provider settings should show:

- connected status
- last validation time
- key fingerprint
- monthly usage
- provider health

Never show raw provider keys after save.

## 7. Files Should Have Lifecycle States

File UX should show:

```txt
Uploading
Processing
Ready
Failed
```

Users should understand whether a file is usable by selected models.

## 8. Advanced Power, Simple Defaults

The app should be powerful but not overwhelming.

Defaults should work:

- recommended models
- safe context window
- reasonable max tokens
- clear mode selection

Advanced users can customize:

- per-model settings
- system prompts
- context policy
- council models
- budget limits

## 9. Every Run Should Be Explainable

Users should be able to inspect:

- models used
- settings used
- time taken
- cost
- token usage
- failures/retries

## 10. Preserve Flow

The composer should feel fast and reliable.

Avoid:

- losing drafts
- jumping layout during streaming
- blocking all models because one failed
- requiring repeated setup

## Target Product Modes

### Single Mode

Feels like a polished ChatGPT-style experience with model transparency.

### Compare Mode

Feels like an AI model lab.

The user asks one prompt and can judge answers side by side with metrics.

### Council Mode

Feels like an AI advisory board.

The user receives independent reasoning, peer review, and final synthesis.

## Empty States

Empty states should guide users.

Examples:

```txt
Choose a model to start chatting.
Add 2–5 models to compare responses.
Start a council to get independent answers and a synthesized recommendation.
```

## Error UX

Good error:

```txt
OpenAI rejected this request because the context is too large. Try reducing context to last 10 messages.
```

Bad error:

```txt
Failed to fetch
```

## Metrics in UI

Expose useful metrics without clutter:

- response time
- tokens
- estimated/actual cost
- retry count
- finish reason when relevant

## Future UX Ideas

- Mark best response.
- Synthesize selected responses.
- Diff responses.
- Ask a follow-up to only one model.
- Promote a model answer into final notes.
- Save model comparison as report.
- Team comments on responses.
- Model leaderboard per workspace.
