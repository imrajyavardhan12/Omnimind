import { and, eq } from 'drizzle-orm'
import type { Db } from '../client.js'
import { providerKeys, type ProviderKey, type NewProviderKey } from '../schema/index.js'

export class ProviderKeyRepository {
  constructor(private readonly db: Db) {}

  async findByWorkspace(workspaceId: string): Promise<Omit<ProviderKey, 'encryptedKey'>[]> {
    const rows = await this.db
      .select({
        id: providerKeys.id,
        workspaceId: providerKeys.workspaceId,
        provider: providerKeys.provider,
        keyHint: providerKeys.keyHint,
        createdByUserId: providerKeys.createdByUserId,
        createdAt: providerKeys.createdAt,
        updatedAt: providerKeys.updatedAt,
      })
      .from(providerKeys)
      .where(eq(providerKeys.workspaceId, workspaceId))
    return rows
  }

  async findEncrypted(workspaceId: string, provider: string): Promise<ProviderKey | undefined> {
    const rows = await this.db
      .select()
      .from(providerKeys)
      .where(and(eq(providerKeys.workspaceId, workspaceId), eq(providerKeys.provider, provider)))
      .limit(1)
    return rows[0]
  }

  async upsert(input: NewProviderKey): Promise<Omit<ProviderKey, 'encryptedKey'>> {
    const rows = await this.db
      .insert(providerKeys)
      .values(input)
      .onConflictDoUpdate({
        target: [providerKeys.workspaceId, providerKeys.provider],
        set: {
          encryptedKey: input.encryptedKey,
          keyHint: input.keyHint,
          updatedAt: new Date(),
        },
      })
      .returning({
        id: providerKeys.id,
        workspaceId: providerKeys.workspaceId,
        provider: providerKeys.provider,
        keyHint: providerKeys.keyHint,
        createdByUserId: providerKeys.createdByUserId,
        createdAt: providerKeys.createdAt,
        updatedAt: providerKeys.updatedAt,
      })
    return rows[0]!
  }

  async delete(workspaceId: string, provider: string): Promise<boolean> {
    const rows = await this.db
      .delete(providerKeys)
      .where(and(eq(providerKeys.workspaceId, workspaceId), eq(providerKeys.provider, provider)))
      .returning({ id: providerKeys.id })
    return rows.length > 0
  }
}
