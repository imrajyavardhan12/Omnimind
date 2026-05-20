import { apiFetch } from '@/lib/api/client'
import type { CreateConversationInput, UpdateConversationInput, CreateMessageInput } from '@omnimind/types'

export interface ConversationDto {
  id: string
  workspaceId: string
  title: string
  mode: 'single' | 'compare' | 'council'
  status: 'active' | 'archived' | 'deleted'
  createdAt: string
  updatedAt: string
}

export interface MessageDto {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  contentText: string
  provider: string | null
  model: string | null
  createdAt: string
}

export const conversationsApi = {
  list: (token: string) =>
    apiFetch<{ conversations: ConversationDto[] }>('/v1/conversations', { token }),

  get: (id: string, token: string) =>
    apiFetch<{ conversation: ConversationDto }>(`/v1/conversations/${id}`, { token }),

  create: (input: CreateConversationInput, token: string) =>
    apiFetch<{ conversation: ConversationDto }>('/v1/conversations', {
      method: 'POST',
      body: JSON.stringify(input),
      token,
    }),

  update: (id: string, input: UpdateConversationInput, token: string) =>
    apiFetch<{ conversation: ConversationDto }>(`/v1/conversations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
      token,
    }),

  remove: (id: string, token: string) =>
    apiFetch<{ success: boolean }>(`/v1/conversations/${id}`, { method: 'DELETE', token }),

  listMessages: (conversationId: string, token: string) =>
    apiFetch<{ messages: MessageDto[] }>(`/v1/conversations/${conversationId}/messages`, { token }),

  createMessage: (conversationId: string, input: CreateMessageInput, token: string) =>
    apiFetch<{ message: MessageDto }>(`/v1/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify(input),
      token,
    }),
}
