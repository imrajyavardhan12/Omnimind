'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Mail, Calendar, Key, Shield } from 'lucide-react'

export default function DashboardPage() {
  const { user, signOut } = useAuth()
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut()
    // Force hard redirect to login page
    window.location.href = '/auth/login'
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  const createdAt = new Date(user.created_at)
  const lastSignIn = user.last_sign_in_at ? new Date(user.last_sign_in_at) : null

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to App
          </button>
        </div>

        {/* Page Title */}
        <div>
          <h1 className="text-3xl font-bold">Account Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Manage your OmniMind account settings and preferences
          </p>
        </div>

        {/* Account Information Card */}
        <div className="border border-border rounded-lg p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">Account Information</h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {/* Email */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="w-4 h-4" />
                <span>Email Address</span>
              </div>
              <p className="text-base font-medium">{user.email}</p>
              {user.email_confirmed_at ? (
                <p className="text-xs text-green-500 flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Verified
                </p>
              ) : (
                <p className="text-xs text-yellow-500 flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Not verified
                </p>
              )}
            </div>

            {/* User ID */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Key className="w-4 h-4" />
                <span>User ID</span>
              </div>
              <p className="text-base font-mono text-sm break-all">{user.id}</p>
            </div>

            {/* Account Created */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>Account Created</span>
              </div>
              <p className="text-base">{createdAt.toLocaleDateString()}</p>
              <p className="text-xs text-muted-foreground">
                {createdAt.toLocaleTimeString()}
              </p>
            </div>

            {/* Last Sign In */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>Last Sign In</span>
              </div>
              <p className="text-base">
                {lastSignIn ? lastSignIn.toLocaleDateString() : 'Never'}
              </p>
              {lastSignIn && (
                <p className="text-xs text-muted-foreground">
                  {lastSignIn.toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Authentication Providers */}
        <div className="border border-border rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold">Authentication Methods</h2>
          <div className="space-y-3">
            {user.app_metadata?.provider && (
              <div className="flex items-center justify-between p-3 bg-accent rounded-md">
                <div>
                  <p className="text-sm font-medium capitalize">
                    {user.app_metadata.provider}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Primary authentication method
                  </p>
                </div>
                <div className="text-xs text-green-500">Active</div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="border border-border rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold">Account Actions</h2>
          <div className="flex gap-3">
            <button
              onClick={handleSignOut}
              className="px-4 py-2 bg-red-500/10 text-red-500 border border-red-500/20 rounded-md hover:bg-red-500/20 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
