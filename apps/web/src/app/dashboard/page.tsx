'use client'

import { useUser, useClerk } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Mail, Calendar, Key, Shield } from 'lucide-react'

export default function DashboardPage() {
  const { user } = useUser()
  const { signOut } = useClerk()
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut({ redirectUrl: '/auth/login' })
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  const email = user.primaryEmailAddress?.emailAddress
  const emailVerified = user.primaryEmailAddress?.verification?.status === 'verified'
  const createdAt = user.createdAt ? new Date(user.createdAt) : null
  const lastSignIn = user.lastSignInAt ? new Date(user.lastSignInAt) : null

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push('/chat')}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Chat
          </button>
        </div>

        <div>
          <h1 className="text-3xl font-bold">Account Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Manage your OmniMind account settings and preferences
          </p>
        </div>

        <div className="border border-border rounded-lg p-6 space-y-6">
          <h2 className="text-xl font-semibold mb-4">Account Information</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="w-4 h-4" />
                <span>Email Address</span>
              </div>
              <p className="text-base font-medium">{email}</p>
              {emailVerified ? (
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

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Key className="w-4 h-4" />
                <span>User ID</span>
              </div>
              <p className="text-base font-mono text-sm break-all">{user.id}</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>Account Created</span>
              </div>
              <p className="text-base">{createdAt?.toLocaleDateString() ?? '—'}</p>
              {createdAt && (
                <p className="text-xs text-muted-foreground">{createdAt.toLocaleTimeString()}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>Last Sign In</span>
              </div>
              <p className="text-base">{lastSignIn ? lastSignIn.toLocaleDateString() : 'Never'}</p>
              {lastSignIn && (
                <p className="text-xs text-muted-foreground">{lastSignIn.toLocaleTimeString()}</p>
              )}
            </div>
          </div>
        </div>

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
