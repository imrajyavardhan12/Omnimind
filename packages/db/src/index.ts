export { createDb, type Db } from './client.js'
export * from './schema/index.js'
export { UserRepository } from './repositories/user.repository.js'
export { WorkspaceRepository } from './repositories/workspace.repository.js'
export { ConversationRepository } from './repositories/conversation.repository.js'
export { MessageRepository } from './repositories/message.repository.js'
export { ProviderKeyRepository } from './repositories/provider-key.repository.js'
export { AuditLogRepository } from './repositories/audit-log.repository.js'
export { ModelCatalogRepository } from './repositories/model-catalog.repository.js'
export type { ModelCatalogFilters } from './repositories/model-catalog.repository.js'
export { ModelCatalogService } from './services/model-catalog.service.js'
export type {
  ModelCapability,
  ModelCapabilityRequirements,
  ModelSelectionValidationResult,
  ValidateModelSelectionInput,
} from './services/model-catalog.service.js'
