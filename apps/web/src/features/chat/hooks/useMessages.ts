'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import { conversationsApi } from '@/features/conversations/api/conversationsApi'

export const messageKeys = {
  all: ['messages'] as const,
  list: (conversationId: string) => [...messageKeys.all, 'list', conversationId] as const,
}

/**
 * Server-canonical messages for a conversation (TanStack Query).
 * Messages load from the API, NOT localStorage (06-frontend-architecture.md).
 */
export function useMessages(conversationId: string | undefined) {
  const { getToken } = useAuth()

  return useQuery({
    queryKey: messageKeys.list(conversationId ?? ''),
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      const { messages } = await conversationsApi.listMessages(conversationId as string, token)
      return messages
    },
    enabled: Boolean(conversationId),
  })
}
