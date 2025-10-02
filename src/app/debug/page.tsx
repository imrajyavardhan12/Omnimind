'use client'

export default function DebugPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Environment Variables Debug</h1>
        
        <div className="border border-border rounded-lg p-4 space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">NEXT_PUBLIC_SUPABASE_URL</p>
            <p className="font-mono text-sm break-all">
              {supabaseUrl || '❌ UNDEFINED'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Length: {supabaseUrl?.length || 0} | Trimmed: {supabaseUrl?.trim().length || 0}
            </p>
            {supabaseUrl && supabaseUrl !== supabaseUrl.trim() && (
              <p className="text-xs text-red-500">⚠️ Has whitespace!</p>
            )}
          </div>
          
          <div>
            <p className="text-sm text-muted-foreground">NEXT_PUBLIC_SUPABASE_ANON_KEY</p>
            <p className="font-mono text-sm break-all">
              {supabaseKey 
                ? `✅ ${supabaseKey.substring(0, 30)}...` 
                : '❌ UNDEFINED'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Length: {supabaseKey?.length || 0} | Trimmed: {supabaseKey?.trim().length || 0}
            </p>
            {supabaseKey && supabaseKey !== supabaseKey.trim() && (
              <p className="text-xs text-red-500">⚠️ Has whitespace!</p>
            )}
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

        <div className="border border-border rounded-lg p-4 space-y-3">
          <h2 className="text-lg font-semibold">Validation Tests</h2>
          
          <div>
            <p className="text-sm text-muted-foreground">URL starts with https://</p>
            <p className="text-sm">
              {supabaseUrl?.startsWith('https://') ? '✅ Yes' : '❌ No'}
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">URL ends with .supabase.co</p>
            <p className="text-sm">
              {supabaseUrl?.endsWith('.supabase.co') ? '✅ Yes' : '❌ No'}
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Key starts with eyJ</p>
            <p className="text-sm">
              {supabaseKey?.startsWith('eyJ') ? '✅ Yes' : '❌ No'}
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Key contains dots (.)</p>
            <p className="text-sm">
              {supabaseKey?.includes('.') ? '✅ Yes' : '❌ No (Invalid JWT!)'}
            </p>
          </div>
        </div>

        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
          <p className="text-sm">
            If you see ❌ UNDEFINED or any validation failures, your environment variables have issues.
          </p>
        </div>
      </div>
    </div>
  )
}
