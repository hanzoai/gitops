'use client'

import { useEffect } from 'react'
import { signIn } from 'next-auth/react'

export function AutoSignIn() {
  useEffect(() => {
    // Automatically trigger the hanzo.id OIDC flow
    signIn('hanzo', { callbackUrl: '/orgs' })
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-foreground border-t-transparent mx-auto" />
        <p className="text-sm text-muted-foreground">Redirecting to sign in...</p>
      </div>
    </div>
  )
}
