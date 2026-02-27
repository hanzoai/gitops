import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Lightweight middleware that checks for a session cookie.
 * Does NOT use the DB adapter (which requires Node.js 'net' module).
 * The actual session validation happens server-side in the tRPC handler.
 *
 * Unauthenticated users hitting the root page are handled by the
 * server component (which calls signIn('hanzo')).  All other protected
 * routes redirect to '/' so the sign-in flow is triggered.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public routes — always allow
  if (
    pathname === '/' ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/auth') ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico)$/)
  ) {
    return NextResponse.next()
  }

  // Check for session cookie (presence only — actual validation in tRPC/server)
  const sessionToken =
    request.cookies.get('authjs.session-token')?.value ||
    request.cookies.get('__Secure-authjs.session-token')?.value

  if (!sessionToken) {
    // Redirect to root which handles the signIn flow
    const rootUrl = new URL('/', request.url)
    return NextResponse.redirect(rootUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
