# 01 — Product Vision

## Current Product

OmniMind currently lets users compare AI model responses side by side. It supports single chat, compare mode, council mode, prompt enhancement, API key configuration, file attachments, and local conversation persistence.

The current implementation is useful as an MVP, but many concerns are coupled together:

- UI components initiate provider calls directly or indirectly.
- API keys are stored in the browser.
- Conversations are mostly localStorage-backed.
- Multi-model fan-out is frontend-driven.
- Council Mode is controlled from React hooks.
- Provider-specific behavior is manually implemented in route handlers/classes.

## Target Product

OmniMind v2 should become a production-grade AI workspace for comparing, orchestrating, evaluating, and governing multiple AI models.

The product should support:

1. Single-model chat.
2. Multi-model comparison.
3. Council/debate workflows.
4. Prompt optimization.
5. File and multimodal understanding.
6. Provider key vault/BYOK.
7. Hosted-provider usage with budgets.
8. Usage analytics and cost dashboards.
9. Conversation history across devices.
10. Team/workspace collaboration.
11. Model quality/latency/cost comparison.
12. Enterprise controls such as audit logs and quotas.

## Product Positioning

OmniMind should not just be a chat UI. It should be a **multi-model AI decision workspace**.

The core differentiator is the ability to ask one question and understand:

- Which model answered best?
- Which model was fastest?
- Which model was cheapest?
- Which model reasoned better?
- Which model was more factual?
- What answer emerges when multiple models critique one another?

## Key Product Workflows

### Workflow 1: Single Chat

A user selects one model and chats normally.

### Workflow 2: Compare

A user selects 2–5 models, sends one prompt, and receives model responses through a unified backend run.

### Workflow 3: Council

A user selects council models and a chairman model. The system executes a durable multi-stage workflow:

1. Collect individual answers.
2. Anonymize and rank peer answers.
3. Aggregate rankings.
4. Generate final chairman synthesis.

### Workflow 4: Prompt Enhancement

A user improves a draft prompt using AI and/or template-based analysis before sending it.

### Workflow 5: File-Aware Chat

A user uploads images, PDFs, text files, documents, audio, or video. OmniMind extracts relevant content and provides the correct modality to selected models.

## Non-Goals for Early v2

The rebuild should avoid unnecessary complexity too early.

Do not start with:

- Kubernetes.
- Full enterprise SSO.
- Complex agent marketplaces.
- Premature microservice sprawl.
- Real-time collaborative editing.
- Custom vector database infrastructure.

These can be added after the core architecture is stable.

## Success Criteria

OmniMind v2 is successful when:

1. The frontend no longer directly orchestrates multiple provider calls.
2. Every user message creates a traceable backend run.
3. Every model response is persisted with usage, cost, latency, and status.
4. Provider keys never need to be stored in browser localStorage.
5. The system supports retries, cancellation, and partial failures reliably.
6. Streaming behavior is consistent across providers.
7. Conversations survive reloads, devices, and sessions.
8. Engineers can debug any model response from logs/traces/run records.
