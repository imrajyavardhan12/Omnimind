import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

// Load from local .env.local first, then fall back to apps/api
config({ path: '.env.local' })
config({ path: '../../apps/api/.env.local' })

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL']!,
  },
})
