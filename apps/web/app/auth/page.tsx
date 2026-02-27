'use client'

import { signIn } from 'next-auth/react'
import { Boxes } from 'lucide-react'

export default function AuthPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex items-center gap-2">
          <Boxes className="h-8 w-8" />
          <h1 className="text-3xl font-bold tracking-tight">Hanzo Platform</h1>
        </div>
        <p className="max-w-sm text-sm text-muted-foreground">
          Deploy anywhere. K8s, Docker Swarm, or Compose -- one dashboard.
        </p>
      </div>

      <button
        onClick={() => signIn('hanzo', { callbackUrl: '/orgs' })}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Sign in with Hanzo
      </button>

      <p className="text-xs text-muted-foreground">
        Authenticated via{' '}
        <a
          href="https://hanzo.id"
          className="underline underline-offset-4 hover:text-foreground"
          target="_blank"
          rel="noopener noreferrer"
        >
          hanzo.id
        </a>
      </p>
    </div>
  )
}
