import { eq } from 'drizzle-orm'
import type { Db } from '../client.js'
import { appUsers, type AppUser, type NewAppUser } from '../schema/index.js'

export class UserRepository {
  constructor(private readonly db: Db) {}

  async findByClerkId(clerkUserId: string): Promise<AppUser | undefined> {
    const rows = await this.db
      .select()
      .from(appUsers)
      .where(eq(appUsers.clerkUserId, clerkUserId))
      .limit(1)
    return rows[0]
  }

  async upsertFromClerk(input: NewAppUser): Promise<AppUser> {
    const rows = await this.db
      .insert(appUsers)
      .values(input)
      .onConflictDoUpdate({
        target: appUsers.clerkUserId,
        set: {
          email: input.email,
          name: input.name,
          avatarUrl: input.avatarUrl,
          updatedAt: new Date(),
        },
      })
      .returning()
    return rows[0]!
  }
}
