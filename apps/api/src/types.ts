export interface ApiVariables {
  requestId: string
  clerkUserId: string
  userId: string
  workspaceId: string
  userRole: 'owner' | 'admin' | 'member' | 'viewer'
}
