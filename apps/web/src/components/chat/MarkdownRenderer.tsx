/**
 * Compatibility shim. The streaming-grade markdown renderer now lives in the run
 * feature as `ChatMarkdown` (it's owned by the chat surface). This re-export keeps
 * the remaining legacy importer (the Council stages) working under the old name
 * until Council migrates to backend runs in M8 — then delete this file.
 */
export { ChatMarkdown as MarkdownRenderer } from '@/features/chat/components/ChatMarkdown'
