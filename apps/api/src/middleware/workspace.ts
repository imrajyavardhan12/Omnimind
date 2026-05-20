import { createClerkClient } from '@clerk/backend'
import type { Context, MiddlewareHandler, Next } from 'hono'
import type { Db } from '@omnimind/db'
import { UserRepository, WorkspaceRepository } from '@omnimind/db'
import type { ApiVariables } from '../types.js'

export function createWorkspaceMiddleware(db: Db, clerkSecretKey: string): MiddlewareHandler<{ Variables: ApiVariables }> {
  const clerk = createClerkClient({ secretKey: clerkSecretKey })

  return async (c: Context<{ Variables: ApiVariables }>, next: Next) => {
    const rid = c.get('requestId')
    const clerkUserId = c.get('clerkUserId')
    const userRepo = new UserRepository(db)
    const workspaceRepo = new WorkspaceRepository(db)

    // Fetch Clerk user to get real email/name for the upsert
    let email = `${clerkUserId}@clerk.placeholder`
    let name: string | undefined
    try {
      const clerkUser = await clerk.users.getUser(clerkUserId)
      email = clerkUser.emailAddresses[0]?.emailAddress ?? email
      name = clerkUser.fullName ?? clerkUser.firstName ?? undefined
    } catch {
      // Non-fatal: fallback to placeholder so auth still works
    }

    const user = await userRepo.upsertFromClerk({ clerkUserId, email, name })

    let workspace = await workspaceRepo.findByUserId(user.id)
    if (!workspace) {
      const slug = `workspace-${user.id.slice(0, 8)}`
      workspace = await workspaceRepo.create({ name: 'My Workspace', slug })
      await workspaceRepo.addMember(workspace.id, user.id, 'owner')
    }

    c.set('userId', user.id)
    c.set('workspaceId', workspace.id)
    await next()
  }
}
