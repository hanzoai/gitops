import { z } from 'zod'
import { router, orgProcedure, isOrgRoleAtLeast } from '../trpc'
import type { OrgRole } from '../trpc'
import { domains, clusters } from '@paas/db/schema'
import { eq, and } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'

export const domainRouter = router({
  // List domains for a cluster
  list: orgProcedure
    .input(z.object({
      orgId: z.string(),
      clusterId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      // Verify cluster belongs to this org
      const cluster = await ctx.db.query.clusters.findFirst({
        where: and(eq(clusters.id, input.clusterId), eq(clusters.orgId, input.orgId)),
      })
      if (!cluster) throw new TRPCError({ code: 'NOT_FOUND', message: 'Cluster not found' })

      return ctx.db.query.domains.findMany({
        where: eq(domains.clusterId, input.clusterId),
      })
    }),

  // Add a custom domain to a cluster
  add: orgProcedure
    .input(z.object({
      orgId: z.string(),
      clusterId: z.string(),
      domain: z.string().min(3).max(253),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!isOrgRoleAtLeast(ctx.org.role as OrgRole, 'Admin')) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only owners or admins can add domains' })
      }

      // Verify cluster belongs to this org
      const cluster = await ctx.db.query.clusters.findFirst({
        where: and(eq(clusters.id, input.clusterId), eq(clusters.orgId, input.orgId)),
      })
      if (!cluster) throw new TRPCError({ code: 'NOT_FOUND', message: 'Cluster not found' })

      // Check uniqueness
      const existing = await ctx.db.query.domains.findFirst({
        where: eq(domains.domain, input.domain),
      })
      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Domain already registered' })
      }

      const [domain] = await ctx.db.insert(domains).values({
        domain: input.domain,
        clusterId: input.clusterId,
      }).returning()

      return domain
    }),

  // Remove a domain from a cluster
  remove: orgProcedure
    .input(z.object({
      orgId: z.string(),
      domainId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!isOrgRoleAtLeast(ctx.org.role as OrgRole, 'Admin')) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only owners or admins can remove domains' })
      }

      const domain = await ctx.db.query.domains.findFirst({
        where: eq(domains.id, input.domainId),
      })
      if (!domain) throw new TRPCError({ code: 'NOT_FOUND' })

      // Verify the domain's cluster belongs to this org
      const cluster = await ctx.db.query.clusters.findFirst({
        where: and(eq(clusters.id, domain.clusterId), eq(clusters.orgId, input.orgId)),
      })
      if (!cluster) throw new TRPCError({ code: 'FORBIDDEN' })

      await ctx.db.delete(domains).where(eq(domains.id, input.domainId))
    }),
})
