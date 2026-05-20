import { createBrowserClient } from '@supabase/ssr'

/**
 * Create a Supabase client for client-side usage (in React components)
 * This handles cookie management automatically in the browser
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
