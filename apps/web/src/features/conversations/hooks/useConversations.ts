import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import { conversationsApi } from '../api/conversationsApi'
import type { CreateConversationInput } from '@omnimind/types'

export const conversationKeys = {
  all: ['conversations'] as const,
  list: () => [...conversationKeys.all, 'list'] as const,
  detail: (id: string) => [...conversationKeys.all, 'detail', id] as const,
}

export function useConversations() {
  const { getToken } = useAuth()

  return useQuery({
    queryKey: conversationKeys.list(),
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      const { conversations } = await conversationsApi.list(token)
      return conversations
    },
  })
}

export function useConversation(id: string) {
  const { getToken } = useAuth()

  return useQuery({
    queryKey: conversationKeys.detail(id),
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      const { conversation } = await conversationsApi.get(id, token)
      return conversation
    },
    enabled: Boolean(id),
  })
}

export function useCreateConversation() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateConversationInput) => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      const { conversation } = await conversationsApi.create(input, token)
      return conversation
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.list() })
    },
  })
}
