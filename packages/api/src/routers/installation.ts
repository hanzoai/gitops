import { z } from 'zod'
import { router, orgProcedure, authedProcedure } from '../trpc'
import { gitInstallations } from '@paas/db/schema'
import { eq, and } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'

const GITHUB_APP_SLUG = process.env.GITHUB_APP_SLUG ?? 'hanzo-paas'

export const installationRouter = router({
  // List installations for an org
  list: orgProcedure
    .input(z.object({ orgId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.gitInstallations.findMany({
        where: eq(gitInstallations.orgId, input.orgId),
        columns: {
          id: true,
          provider: true,
          installationId: true,
          accountLogin: true,
          accountType: true,
          permissions: true,
          events: true,
          suspendedAt: true,
          createdAt: true,
          updatedAt: true,
          // Omit accessToken, tokenExpiresAt
        },
      })
    }),

  // Get GitHub App installation URL (redirect user to install the App on their org)
  installUrl: orgProcedure
    .input(z.object({ orgId: z.string() }))
    .query(({ input }) => {
      return {
        url: `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new?state=${input.orgId}`,
      }
    }),

  // Handle installation callback (after user installs the App)
  callback: authedProcedure
    .input(z.object({
      installationId: z.string(),
      orgId: z.string(),
      provider: z.enum(['github', 'gitlab', 'bitbucket']).default('github'),
      accountLogin: z.string(),
      accountType: z.string().default('Organization'),
      permissions: z.record(z.string()).optional(),
      events: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check if already registered
      const existing = await ctx.db.query.gitInstallations.findFirst({
        where: and(
          eq(gitInstallations.orgId, input.orgId),
          eq(gitInstallations.installationId, input.installationId),
        ),
      })

      if (existing) {
        // Update existing installation
        const [updated] = await ctx.db.update(gitInstallations)
          .set({
            permissions: input.permissions ?? null,
            events: input.events ?? null,
            suspendedAt: null, // Un-suspend if re-installed
            updatedAt: new Date(),
          })
          .where(eq(gitInstallations.id, existing.id))
          .returning()
        return updated
      }

      const [installation] = await ctx.db.insert(gitInstallations).values({
        orgId: input.orgId,
        provider: input.provider,
        installationId: input.installationId,
        accountLogin: input.accountLogin,
        accountType: input.accountType,
        permissions: input.permissions ?? null,
        events: input.events ?? null,
      }).returning()

      return installation
    }),

  // Remove installation
  remove: orgProcedure
    .input(z.object({
      orgId: z.string(),
      installationId: z.string(), // our DB id
    }))
    .mutation(async ({ ctx, input }) => {
      const installation = await ctx.db.query.gitInstallations.findFirst({
        where: and(
          eq(gitInstallations.id, input.installationId),
          eq(gitInstallations.orgId, input.orgId),
        ),
      })
      if (!installation) throw new TRPCError({ code: 'NOT_FOUND' })

      await ctx.db.delete(gitInstallations)
        .where(eq(gitInstallations.id, input.installationId))
    }),

  // Manually trigger repo sync for an installation
  sync: orgProcedure
    .input(z.object({
      orgId: z.string(),
      installationId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const installation = await ctx.db.query.gitInstallations.findFirst({
        where: and(
          eq(gitInstallations.id, input.installationId),
          eq(gitInstallations.orgId, input.orgId),
        ),
      })
      if (!installation) throw new TRPCError({ code: 'NOT_FOUND' })

      // Enqueue sync job
      const { syncQueue } = await import('@paas/jobs')
      await syncQueue.add('sync', {
        installationId: installation.id,
        fullSync: true,
      })

      return { queued: true }
    }),
})
