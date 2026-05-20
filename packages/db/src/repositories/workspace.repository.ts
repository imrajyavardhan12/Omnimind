import { eq } from 'drizzle-orm'
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
