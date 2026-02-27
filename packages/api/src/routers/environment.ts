import { z } from 'zod'
import { router, projectProcedure, getOrchestrator, isOrgRoleAtLeast } from '../trpc'
import type { OrgRole } from '../trpc'
import { environments, environmentApprovals, organizations } from '@paas/db/schema'
import { eq, and } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { createId } from '@paralleldrive/cuid2'

export const environmentRouter = router({
  // List environments in a project
  list: projectProcedure
    .input(z.object({
      orgId: z.string(),
      projectId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.environments.findMany({
        where: and(
          eq(environments.projectId, input.projectId),
          eq(environments.orgId, input.orgId),
        ),
      })
    }),

  // Get a single environment
  get: projectProcedure
    .input(z.object({
      orgId: z.string(),
      projectId: z.string(),
      environmentId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const env = await ctx.db.query.environments.findFirst({
        where: and(
          eq(environments.id, input.environmentId),
          eq(environments.projectId, input.projectId),
        ),
      })
      if (!env) throw new TRPCError({ code: 'NOT_FOUND' })
      return env
    }),

  // Create a new environment (also creates namespace on target cluster)
  create: projectProcedure
    .input(z.object({
      orgId: z.string(),
      projectId: z.string(),
      name: z.string().min(2).max(64),
      clusterId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const iid = `env-${createId().slice(0, 12)}`

      const [env] = await ctx.db.insert(environments).values({
        iid,
        orgId: input.orgId,
        projectId: input.projectId,
        name: input.name,
        createdBy: ctx.user.id,
      }).returning()

      // Create the namespace on the target cluster
      try {
        const orch = await getOrchestrator(ctx.db, input.clusterId)
        await orch.createNamespace(iid)
      } catch {
        // Namespace creation failed — still keep the DB record, but log the error
      }

      return env
    }),

  // Delete an environment (also deletes namespace)
  delete: projectProcedure
    .input(z.object({
      orgId: z.string(),
      projectId: z.string(),
      environmentId: z.string(),
      clusterId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!isOrgRoleAtLeast(ctx.org.role as OrgRole, 'Admin')) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only owners or admins can delete environments' })
      }

      const env = await ctx.db.query.environments.findFirst({
        where: and(
          eq(environments.id, input.environmentId),
          eq(environments.projectId, input.projectId),
        ),
      })
      if (!env) throw new TRPCError({ code: 'NOT_FOUND' })

      // Delete namespace from the cluster
      try {
        const orch = await getOrchestrator(ctx.db, input.clusterId)
        await orch.deleteNamespace(env.iid)
      } catch {
        // Namespace may not exist — still delete DB record
      }

      await ctx.db.delete(environments).where(eq(environments.id, input.environmentId))
    }),

  // --- Environment protection endpoints ---

  // Set the protection level for an environment (Admin/Owner only)
  setProtection: projectProcedure
    .input(z.object({
      orgId: z.string(),
      projectId: z.string(),
      environmentId: z.string(),
      protectionLevel: z.enum(['none', 'restricted', 'locked']),
      approvalRequired: z.boolean().optional(),
      allowedUserIds: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!isOrgRoleAtLeast(ctx.org.role as OrgRole, 'Admin')) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only owners or admins can set environment protection' })
      }

      const env = await ctx.db.query.environments.findFirst({
        where: and(
          eq(environments.id, input.environmentId),
          eq(environments.projectId, input.projectId),
        ),
      })
      if (!env) throw new TRPCError({ code: 'NOT_FOUND' })

      const updates: Record<string, unknown> = {
        protectionLevel: input.protectionLevel,
        updatedBy: ctx.user.id,
        updatedAt: new Date(),
      }
      if (input.approvalRequired !== undefined) {
        updates.approvalRequired = input.approvalRequired
      }
      if (input.allowedUserIds !== undefined) {
        updates.allowedUserIds = input.allowedUserIds
      }

      const [updated] = await ctx.db.update(environments)
        .set(updates)
        .where(eq(environments.id, input.environmentId))
        .returning()

      return updated
    }),

  // Request deploy approval for a protected environment
  requestApproval: projectProcedure
    .input(z.object({
      orgId: z.string(),
      projectId: z.string(),
      environmentId: z.string(),
      deploymentId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const env = await ctx.db.query.environments.findFirst({
        where: and(
          eq(environments.id, input.environmentId),
          eq(environments.projectId, input.projectId),
        ),
      })
      if (!env) throw new TRPCError({ code: 'NOT_FOUND' })

      if (env.protectionLevel === 'none' && !env.approvalRequired) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Environment does not require approval' })
      }

      const [approval] = await ctx.db.insert(environmentApprovals).values({
        environmentId: input.environmentId,
        deploymentId: input.deploymentId ?? null,
        requestedBy: ctx.user.id,
      }).returning()

      return approval
    }),

  // Approve or reject a deploy request (Admin/Owner only)
  reviewApproval: projectProcedure
    .input(z.object({
      orgId: z.string(),
      projectId: z.string(),
      approvalId: z.string(),
      decision: z.enum(['approved', 'rejected']),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!isOrgRoleAtLeast(ctx.org.role as OrgRole, 'Admin')) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only owners or admins can review approvals' })
      }

      const approval = await ctx.db.query.environmentApprovals.findFirst({
        where: eq(environmentApprovals.id, input.approvalId),
      })
      if (!approval) throw new TRPCError({ code: 'NOT_FOUND' })
      if (approval.status !== 'pending') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Approval already ${approval.status}` })
      }

      const [updated] = await ctx.db.update(environmentApprovals)
        .set({
          status: input.decision,
          reviewedBy: ctx.user.id,
          reviewedAt: new Date(),
        })
        .where(eq(environmentApprovals.id, input.approvalId))
        .returning()

      return updated
    }),

  // List pending approvals for an environment
  listApprovals: projectProcedure
    .input(z.object({
      orgId: z.string(),
      projectId: z.string(),
      environmentId: z.string(),
      status: z.enum(['pending', 'approved', 'rejected']).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const conditions = [eq(environmentApprovals.environmentId, input.environmentId)]
      if (input.status) {
        conditions.push(eq(environmentApprovals.status, input.status))
      }

      return ctx.db.query.environmentApprovals.findMany({
        where: and(...conditions),
        orderBy: (ea, { desc }) => [desc(ea.createdAt)],
      })
    }),
})
