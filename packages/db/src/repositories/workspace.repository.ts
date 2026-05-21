import { and, eq } from 'drizzle-orm'
import type { Db } from '../client.js'
import {
  workspaces,
  workspaceMembers,
  type Workspace,
  type NewWorkspace,
  type WorkspaceMember,
} from '../schema/index.js'

export class WorkspaceRepository {
  constructor(private readonly db: Db) {}

  async findByUserId(userId: string): Promise<Workspace | undefined> {
    const rows = await this.db
      .select({ workspace: workspaces })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
      .where(eq(workspaceMembers.userId, userId))
      .limit(1)
    return rows[0]?.workspace
  }

  async findOrCreateDefault(userId: string): Promise<{ workspace: Workspace; role: WorkspaceMember['role'] }> {
    // Fast path: existing users return immediately.
    const existing = await this.db
      .select({ workspace: workspaces, role: workspaceMembers.role })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
      .where(eq(workspaceMembers.userId, userId))
      .orderBy(workspaceMembers.createdAt)
      .limit(1)

    if (existing[0]) return existing[0]

    // Slow path: first-ever request for this user.
    // Slug is deterministic on userId so concurrent first-time requests converge on one workspace.
    // ON CONFLICT DO UPDATE returns the row whether just-created or already-existing.
    const slug = `workspace-${userId}`
    const [workspace] = await this.db
      .insert(workspaces)
      .values({ name: 'My Workspace', slug })
      .onConflictDoUpdate({ target: workspaces.slug, set: { updatedAt: new Date() } })
      .returning()

    // ON CONFLICT DO NOTHING — the unique index on (workspace_id, user_id) makes this idempotent.
    await this.db
      .insert(workspaceMembers)
      .values({ workspaceId: workspace!.id, userId, role: 'owner' })
      .onConflictDoNothing()

    // Re-read to get definitive role (handles the case where another request won the member insert).
    const result = await this.db
      .select({ workspace: workspaces, role: workspaceMembers.role })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
      .where(eq(workspaceMembers.userId, userId))
      .orderBy(workspaceMembers.createdAt)
      .limit(1)

    return result[0]!
  }

  async findMemberRole(workspaceId: string, userId: string): Promise<WorkspaceMember['role'] | undefined> {
    const rows = await this.db
      .select({ role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
      .limit(1)
    return rows[0]?.role
  }

  async create(input: NewWorkspace): Promise<Workspace> {
    const rows = await this.db.insert(workspaces).values(input).returning()
    return rows[0]!
  }

  async addMember(
    workspaceId: string,
    userId: string,
    role: WorkspaceMember['role'] = 'owner',
  ): Promise<WorkspaceMember> {
    const rows = await this.db
      .insert(workspaceMembers)
      .values({ workspaceId, userId, role })
      .returning()
    return rows[0]!
  }
}
