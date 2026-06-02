/**
 * Compatibility shim. The streaming-grade markdown renderer now lives in the run
 * feature as `ChatMarkdown` (it's owned by the chat surface). This re-export keeps
 * the legacy importers (Council stages, DynamicChatPanel, SingleChatInterface)
 * working under the old name until they retire in M8 — then delete this file.
 */
export { ChatMarkdown as MarkdownRenderer } from '@/features/chat/components/ChatMarkdown'
