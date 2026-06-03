Phase/Milestone: M6.5 — Frontend Foundation (bounded pass before M7) (2026-06-03)

Summary:
M6.5 turned the backend-run chat view from an MVP-grafted surface into a clean,
dogfoodable shell. NOT a rewrite — the backend (run engine / data model / gateway /
SSE / API contracts) was untouched; this is presentation + thin client wiring only.
Merged to origin/main @ee36884 (fast-forward). Net -1346 lines (+823 / -2169): it
DELETED ~2.2k lines of legacy MVP UI while adding the clean foundation.
Scope (locked): docs/m6.5-frontend-foundation.md.

State at start: HEAD 356c9b7 (M6 live-click-through hardening merged), clean tree.

WORK (8 commits, cb500c4..ee36884):
  cb500c4  docs: lock the M6.5 scope.
  d23fb45  Conversation sidebar — RunConversationSidebar (GET /v1/conversations;
           list / select / new / delete via useDeleteConversation), OWNED by RunChatView
           (rendered inside it) so selecting a conversation resets in-flight run state
           synchronously (no cross-component race). Replaced the interim header dropdown
           (RunConversationList, deleted) + the hidden legacy localStorage ConversationSidebar.
  6e079e6  Tasteful visual pass — user prompts = right-aligned bubbles, assistant = full-width
           + model label (was two identical bordered cards); live-panel width matches the
           message column (single narrow / compare wide); consistent radii/borders.
  5599d0a  Owned streaming renderer — git mv components/chat/MarkdownRenderer ->
           features/chat/components/ChatMarkdown (history preserved); run surfaces import
           ChatMarkdown. A 1-line re-export shim remains at the old path for the Council
           stages (delete it when Council migrates in M8).
  7f8dd55  Frontend standards — docs/architecture/06b-frontend-standards.md (enforced rules);
           linked from the AGENTS.md frontend reading list.
  7232930  Retire the single/compare dual-path — removed the chatRunsEnabled flag
           (lib/featureFlags.ts deleted) + the flag-OFF legacy UI (SingleChatInterface,
           AnimatedUnifiedInput, DynamicChatPanel deleted) + the legacy compare chrome from
           chat/page.tsx. RunChatView is now the ONLY single/compare path.
           /chat bundle 2.71 MB -> 135 kB.
  a9a021a  Code-block streaming flicker fixed (CodeBlock shows plain text while streaming,
           Prism-highlights once content settles — 150ms debounce) + first send/stop redesign.
  ee36884  Send/Stop button = ChatGPT/Claude composer style (solid foreground circle, bold
           up-arrow / small rounded square stop; dropped the orange-gradient circle).

Validation: type-check 9/9, lint clean, test 129, build 2/2 — green at every step.
Operator-verified live: sidebar list/select/new/delete; bubbles; persisted metadata footer;
code streams without flicker; ChatGPT-style button; single/compare/council/settings all load.

Scope compliance: not a rewrite; backend frozen; Council untouched (STILL legacy — uses the
MarkdownRenderer shim + the legacy localStorage stores useChatStore/useModelTabsStore) until M8.

KNOWN GAPS / FOLLOW-UPS (priority order):
  1. CANCEL-PERSISTENCE (backend / run-engine) — cancelling a run persists the user prompt
     but NOT the partial assistant output: the partial vanishes (it was only in the client
     buffer) AND the dangling unanswered question pollutes the next turn's context (the model
     answers both). Fix: persist the partial assistant text on cancel (status cancelled). See
     docs/prompts/start-cancel-persistence-fix-agent-prompt.md. Do this BEFORE serious dogfooding.
  2. Stale OpenRouter catalog slugs — several "(via OpenRouter)" models return "No endpoints
     found"; only openai/gpt-4o is routable. Re-sync the catalog (needs M3 POST /v1/models/sync,
     not yet built).
  3. Council on the legacy path until M8 (then delete the MarkdownRenderer shim + the legacy
     localStorage stores it depends on).
  4. Cmd/Ctrl+K ModelCommandPalette still edits the legacy modelTabsStore (orphaned in run
     mode) — M11 cleanup.

Next recommended task: dogfood the core; do the cancel-persistence fix (#1); then sequence
M7 (file pipeline) / M8 (council v2) / M9 (observability) by real usage, not fixed plan order.

Docs updated: docs/handoff-m6.5.md (this), docs/m6.5-frontend-foundation.md (Outcome),
docs/architecture/06b-frontend-standards.md (new), AGENTS.md (frontend reading list).
