import { z } from 'zod'
import { router, authedProcedure } from '../trpc'
import { gitProviders } from '@paas/db/schema'
import { eq, and } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { createId } from '@paralleldrive/cuid2'

export const gitRouter = router({
  // List git providers for the current user
  list: authedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.gitProviders.findMany({
      where: eq(gitProviders.userId, ctx.user.id),
      columns: {
        id: true,
        iid: true,
        provider: true,
        username: true,
        email: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
        // Omit accessToken, refreshToken
      },
    })
  }),

  // Connect a git provider (store OAuth tokens)
  connect: authedProcedure
    .input(z.object({
      provider: z.enum(['github', 'gitlab', 'bitbucket']),
      providerUserId: z.string(),
      accessToken: z.string(),
      refreshToken: z.string().optional(),
      expiresAt: z.string().datetime().optional(),
      username: z.string().optional(),
      email: z.string().email().optional(),
      avatar: z.string().url().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check if already connected for this provider + providerUserId
      const existing = await ctx.db.query.gitProviders.findFirst({
        where: and(
          eq(gitProviders.userId, ctx.user.id),
          eq(gitProviders.provider, input.provider),
          eq(gitProviders.providerUserId, input.providerUserId),
        ),
      })

      if (existing) {
        // Update tokens
        const [updated] = await ctx.db.update(gitProviders)
          .set({
            accessToken: input.accessToken,
            refreshToken: input.refreshToken ?? null,
            expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
            username: input.username ?? existing.username,
            email: input.email ?? existing.email,
            avatar: input.avatar ?? existing.avatar,
            updatedAt: new Date(),
          })
          .where(eq(gitProviders.id, existing.id))
          .returning()

        return { id: updated.id, provider: updated.provider, username: updated.username }
      }

      const iid = `git-${createId().slice(0, 12)}`

      const [provider] = await ctx.db.insert(gitProviders).values({
        iid,
        userId: ctx.user.id,
        provider: input.provider,
        providerUserId: input.providerUserId,
        accessToken: input.accessToken,
        refreshToken: input.refreshToken ?? null,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        username: input.username ?? null,
        email: input.email ?? null,
        avatar: input.avatar ?? null,
      }).returning()

      return { id: provider.id, provider: provider.provider, username: provider.username }
    }),

  // Disconnect a git provider
  disconnect: authedProcedure
    .input(z.object({ gitProviderId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const provider = await ctx.db.query.gitProviders.findFirst({
        where: and(eq(gitProviders.id, input.gitProviderId), eq(gitProviders.userId, ctx.user.id)),
      })
      if (!provider) throw new TRPCError({ code: 'NOT_FOUND' })

      await ctx.db.delete(gitProviders).where(eq(gitProviders.id, input.gitProviderId))
    }),

  // List repos from a connected provider
  // Note: This is a thin proxy — real implementation calls the provider's API
  repos: authedProcedure
    .input(z.object({
      gitProviderId: z.string(),
      page: z.number().min(1).default(1),
      perPage: z.number().min(1).max(100).default(30),
      search: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const provider = await ctx.db.query.gitProviders.findFirst({
        where: and(eq(gitProviders.id, input.gitProviderId), eq(gitProviders.userId, ctx.user.id)),
      })
      if (!provider) throw new TRPCError({ code: 'NOT_FOUND' })

      // Fetch repos from the git provider's API
      const headers: Record<string, string> = { Accept: 'application/json' }
      let url: string

      switch (provider.provider) {
        case 'github': {
          headers.Authorization = `Bearer ${provider.accessToken}`
          const q = input.search ? `&q=${encodeURIComponent(input.search)}` : ''
          url = `https://api.github.com/user/repos?page=${input.page}&per_page=${input.perPage}&sort=updated${q}`
          break
        }
        case 'gitlab': {
          headers['PRIVATE-TOKEN'] = provider.accessToken
          const search = input.search ? `&search=${encodeURIComponent(input.search)}` : ''
          url = `https://gitlab.com/api/v4/projects?membership=true&page=${input.page}&per_page=${input.perPage}&order_by=updated_at${search}`
          break
        }
        case 'bitbucket': {
          headers.Authorization = `Bearer ${provider.accessToken}`
          const q = input.search ? `&q=name~"${encodeURIComponent(input.search)}"` : ''
          url = `https://api.bitbucket.org/2.0/repositories/${provider.username}?page=${input.page}&pagelen=${input.perPage}${q}`
          break
        }
        default:
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Unsupported provider' })
      }

      const res = await fetch(url, { headers })
      if (!res.ok) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Git provider API returned ${res.status}`,
        })
      }

      const data = await res.json()

      // Normalize response format across providers
      if (provider.provider === 'github') {
        return (data as Array<Record<string, unknown>>).map((r) => ({
          id: String(r.id),
          name: r.name as string,
          fullName: r.full_name as string,
          url: r.html_url as string,
          cloneUrl: r.clone_url as string,
          defaultBranch: r.default_branch as string,
          private: r.private as boolean,
          updatedAt: r.updated_at as string,
        }))
      }

      if (provider.provider === 'gitlab') {
        return (data as Array<Record<string, unknown>>).map((r) => ({
          id: String(r.id),
          name: r.name as string,
          fullName: r.path_with_namespace as string,
          url: r.web_url as string,
          cloneUrl: r.http_url_to_repo as string,
          defaultBranch: r.default_branch as string,
          private: (r.visibility as string) === 'private',
          updatedAt: r.last_activity_at as string,
        }))
      }

      // Bitbucket
      const values = (data as Record<string, unknown>).values as Array<Record<string, unknown>>
      return (values ?? []).map((r) => ({
        id: r.uuid as string,
        name: r.name as string,
        fullName: r.full_name as string,
        url: (r.links as Record<string, Record<string, string>>)?.html?.href ?? '',
        cloneUrl: ((r.links as Record<string, Array<Record<string, string>>>)?.clone?.find(
          (c) => c.name === 'https',
        )?.href) ?? '',
        defaultBranch: (r.mainbranch as Record<string, string>)?.name ?? 'main',
        private: r.is_private as boolean,
        updatedAt: r.updated_on as string,
      }))
    }),
})
