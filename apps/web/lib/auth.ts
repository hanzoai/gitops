import NextAuth from 'next-auth'
import type { NextAuthConfig } from 'next-auth'
import { db } from '@paas/db'
import { users, sessions, accounts } from '@paas/db/schema'
import { eq, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'

// Custom Casdoor OIDC provider for hanzo.id
const issuer = process.env.HANZO_IAM_ISSUER ?? 'https://hanzo.id'

const hanzoProvider = {
  id: 'hanzo',
  name: 'Hanzo',
  type: 'oidc' as const,
  issuer,
  clientId: process.env.HANZO_IAM_CLIENT_ID,
  clientSecret: process.env.HANZO_IAM_CLIENT_SECRET,
  authorization: {
    url: `${issuer}/login/oauth/authorize`,
    params: { scope: 'openid profile email' },
  },
  token: `${issuer}/api/login/oauth/access_token`,
  userinfo: `${issuer}/api/userinfo`,
  profile(profile: Record<string, unknown>) {
    return {
      id: profile.sub as string,
      name: (profile.name ?? profile.preferred_username ?? '') as string,
      email: (profile.email ?? '') as string,
      image: (profile.picture ?? profile.avatar ?? '') as string,
    }
  },
}

// Minimal adapter that maps next-auth operations to the existing
// users / sessions / accounts tables in @paas/db.
// We avoid @auth/drizzle-adapter to prevent version conflicts with beta.30.
const paasAdapter = {
  async createUser(data: { name?: string | null; email?: string | null; image?: string | null; emailVerified?: Date | null }) {
    const iid = `usr-${randomUUID().replace(/-/g, '').slice(0, 12)}`
    const [user] = await db.insert(users).values({
      iid,
      name: data.name ?? null,
      email: data.email ?? null,
      pictureUrl: data.image ?? null,
      provider: 'hanzo',
      providerUserId: iid, // will be updated on linkAccount
    }).returning()
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: null,
      image: user.pictureUrl,
    }
  },

  async getUser(id: string) {
    const user = await db.query.users.findFirst({ where: eq(users.id, id) })
    if (!user) return null
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: null,
      image: user.pictureUrl,
    }
  },

  async getUserByEmail(email: string) {
    const user = await db.query.users.findFirst({ where: eq(users.email, email) })
    if (!user) return null
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: null,
      image: user.pictureUrl,
    }
  },

  async getUserByAccount(provider_accountId: { provider: string; providerAccountId: string }) {
    const account = await db.query.accounts.findFirst({
      where: and(
        eq(accounts.provider, provider_accountId.provider),
        eq(accounts.providerAccountId, provider_accountId.providerAccountId),
      ),
    })
    if (!account) return null
    const user = await db.query.users.findFirst({ where: eq(users.id, account.userId) })
    if (!user) return null
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: null,
      image: user.pictureUrl,
    }
  },

  async updateUser(data: { id: string; name?: string | null; email?: string | null; image?: string | null }) {
    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (data.name !== undefined) updates.name = data.name
    if (data.email !== undefined) updates.email = data.email
    if (data.image !== undefined) updates.pictureUrl = data.image

    const [user] = await db.update(users)
      .set(updates)
      .where(eq(users.id, data.id))
      .returning()
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: null,
      image: user.pictureUrl,
    }
  },

  async linkAccount(data: {
    userId: string
    provider: string
    providerAccountId: string
    type: string
    access_token?: string
    refresh_token?: string
    expires_at?: number
    token_type?: string
    scope?: string
    id_token?: string
    session_state?: string
  }) {
    await db.insert(accounts).values({
      id: randomUUID(),
      userId: data.userId,
      type: data.type,
      provider: data.provider,
      providerAccountId: data.providerAccountId,
      accessToken: data.access_token ?? null,
      refreshToken: data.refresh_token ?? null,
      expiresAt: data.expires_at ? new Date(data.expires_at * 1000) : null,
      tokenType: data.token_type ?? null,
      scope: data.scope ?? null,
      idToken: data.id_token ?? null,
      sessionState: data.session_state ?? null,
    })

    // Update the user's provider info to match the linked account
    await db.update(users)
      .set({
        provider: data.provider === 'hanzo' ? 'hanzo' : data.provider,
        providerUserId: data.providerAccountId,
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, data.userId))
  },

  async createSession(data: { sessionToken: string; userId: string; expires: Date }) {
    await db.insert(sessions).values({
      sessionToken: data.sessionToken,
      userId: data.userId,
      expires: data.expires,
    })
    return data
  },

  async getSessionAndUser(sessionToken: string) {
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.sessionToken, sessionToken),
    })
    if (!session) return null

    const user = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
    })
    if (!user) return null

    return {
      session: {
        sessionToken: session.sessionToken,
        userId: session.userId,
        expires: session.expires,
      },
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: null,
        image: user.pictureUrl,
      },
    }
  },

  async updateSession(data: { sessionToken: string; expires?: Date }) {
    if (data.expires) {
      await db.update(sessions)
        .set({ expires: data.expires })
        .where(eq(sessions.sessionToken, data.sessionToken))
    }
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.sessionToken, data.sessionToken),
    })
    return session ?? null
  },

  async deleteSession(sessionToken: string) {
    await db.delete(sessions).where(eq(sessions.sessionToken, sessionToken))
  },
}

export const authConfig: NextAuthConfig = {
  adapter: paasAdapter as any,
  providers: [hanzoProvider as any],
  session: { strategy: 'database' },
  callbacks: {
    authorized({ auth: session, request }) {
      const isLoggedIn = !!session?.user
      const isOnAuth = request.nextUrl.pathname.startsWith('/auth')
      const isOnApi = request.nextUrl.pathname.startsWith('/api')
      const isOnRoot = request.nextUrl.pathname === '/'

      // Allow public pages
      if (isOnAuth || isOnApi || isOnRoot) return true

      // Redirect unauthenticated users to /auth
      if (!isLoggedIn) return false // next-auth redirects to pages.signIn

      return true
    },
    async session({ session, user }) {
      // Enrich session with PaaS-specific user fields
      const dbUser = await db.query.users.findFirst({
        where: eq(users.id, user.id),
      })
      if (dbUser) {
        session.user.id = dbUser.id
        ;(session.user as any).isClusterOwner = dbUser.isClusterOwner
        ;(session.user as any).canCreateOrg = dbUser.canCreateOrg
      }
      return session
    },
  },
}

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)
