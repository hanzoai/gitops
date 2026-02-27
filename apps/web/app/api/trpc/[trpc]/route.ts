import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from '@paas/api'
import type { Context } from '@paas/api'
import { db } from '@paas/db'
import { auth } from '@/lib/auth'
import { users } from '@paas/db/schema'
import { eq } from 'drizzle-orm'

async function createContext(): Promise<Context> {
  const session = await auth()

  if (!session?.user?.id) {
    return { db, session: null }
  }

  // Load PaaS-specific fields from the database
  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  })

  if (!dbUser) {
    return { db, session: null }
  }

  return {
    db,
    session: {
      user: {
        id: dbUser.id,
        email: dbUser.email ?? '',
        isClusterOwner: dbUser.isClusterOwner,
        canCreateOrg: dbUser.canCreateOrg,
      },
    },
  }
}

function handler(req: Request) {
  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext,
  })
}

export { handler as GET, handler as POST }
