import { z } from 'zod'

export const conversationModeSchema = z.enum(['single', 'compare', 'council'])
export const conversationStatusSchema = z.enum(['active', 'archived', 'deleted'])
export const messageRoleSchema = z.enum(['user', 'assistant', 'system', 'tool'])

export const createConversationSchema = z.object({
  title: z.string().min(1).max(500),
  mode: conversationModeSchema.default('single'),
})

export const updateConversationSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  status: z.enum(['active', 'archived']).optional(),
})

export const createMessageSchema = z.object({
  role: messageRoleSchema,
  contentText: z.string().min(1),
  provider: z.string().optional(),
  model: z.string().optional(),
})

export const listConversationsQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  status: z.enum(['active', 'archived']).optional(),
})

export const listMessagesQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(500).default(200),
})

export type CreateConversationInput = z.infer<typeof createConversationSchema>
export type UpdateConversationInput = z.infer<typeof updateConversationSchema>
export type CreateMessageInput = z.infer<typeof createMessageSchema>
