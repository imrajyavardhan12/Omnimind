'use client'

export default function DebugPage() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Environment Variables Debug</h1>
        
        <div className="border border-border rounded-lg p-4 space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">NEXT_PUBLIC_SUPABASE_URL</p>
            <p className="font-mono text-sm break-all">
              {process.env.NEXT_PUBLIC_SUPABASE_URL || '❌ UNDEFINED'}
            </p>
          </div>
          
          <div>
            <p className="text-sm text-muted-foreground">NEXT_PUBLIC_SUPABASE_ANON_KEY</p>
            <p className="font-mono text-sm break-all">
              {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY 
                ? `✅ ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 30)}...` 
                : '❌ UNDEFINED'}
            </p>
          </div>
          
          <div>
            <p className="text-sm text-muted-foreground">NEXT_PUBLIC_APP_URL</p>
            <p className="font-mono text-sm break-all">
              {process.env.NEXT_PUBLIC_APP_URL || '❌ UNDEFINED'}
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">NODE_ENV</p>
            <p className="font-mono text-sm">
              {process.env.NODE_ENV || '❌ UNDEFINED'}
            </p>
          </div>
        </div>

        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
          <p className="text-sm">
            If you see ❌ UNDEFINED above, your environment variables are not loaded correctly in Vercel.
          </p>
        </div>
      </div>
    </div>
  )
}
