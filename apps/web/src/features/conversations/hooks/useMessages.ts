import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import { conversationsApi } from '../api/conversationsApi'
import { conversationKeys } from './useConversations'
import type { CreateMessageInput } from '@omnimind/types'

const messageKeys = {
  all: (conversationId: string) => ['messages', conversationId] as const,
  list: (conversationId: string) => [...messageKeys.all(conversationId), 'list'] as const,
}

export function useMessages(conversationId: string) {
  const { getToken } = useAuth()

  return useQuery({
    queryKey: messageKeys.list(conversationId),
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      const { messages } = await conversationsApi.listMessages(conversationId, token)
      return messages
    },
    enabled: Boolean(conversationId),
  })
}

export function useCreateMessage(conversationId: string) {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateMessageInput) => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      const { message } = await conversationsApi.createMessage(conversationId, input, token)
      return message
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messageKeys.list(conversationId) })
      queryClient.invalidateQueries({ queryKey: conversationKeys.detail(conversationId) })
    },
  })
}
