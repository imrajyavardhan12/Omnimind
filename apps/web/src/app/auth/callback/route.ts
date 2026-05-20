import { NextResponse } from 'next/server'

// Clerk handles auth callbacks natively via its middleware.
// This route is kept as a redirect safety net.
export function GET() {
  return NextResponse.redirect(new URL('/chat', process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000'))
}
