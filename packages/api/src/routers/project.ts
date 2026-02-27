import { z } from 'zod'
import { router, orgProcedure, isOrgRoleAtLeast } from '../trpc'
import type { OrgRole } from '../trpc'
import { projects, projectMembers } from '@paas/db/schema'
import { eq, and } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { createId } from '@paralleldrive/cuid2'

export const projectRouter = router({
  // List all projects in an org
  list: orgProcedure
    .input(z.object({ orgId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.projects.findMany({
        where: eq(projects.orgId, input.orgId),
      })
    }),

  // Get a single project
  get: orgProcedure
    .input(z.object({ orgId: z.string(), projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.db.query.projects.findFirst({
        where: and(eq(projects.id, input.projectId), eq(projects.orgId, input.orgId)),
      })
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' })
      return project
    }),

  // Create a new project in an org
  create: orgProcedure
    .input(z.object({
      orgId: z.string(),
      name: z.string().min(2).max(64),
    }))
    .mutation(async ({ ctx, input }) => {
      const iid = `prj-${createId().slice(0, 12)}`

      const [project] = await ctx.db.insert(projects).values({
        iid,
        orgId: input.orgId,
        name: input.name,
        ownerUserId: ctx.user.id,
        createdBy: ctx.user.id,
      }).returning()

      // Add creator as Admin project member
      await ctx.db.insert(projectMembers).values({
        projectId: project.id,
        userId: ctx.user.id,
        role: 'Admin',
      })

      return project
    }),

  // Update project name
  update: orgProcedure
    .input(z.object({
      orgId: z.string(),
      projectId: z.string(),
      name: z.string().min(2).max(64).optional(),
      pictureUrl: z.string().url().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.db.query.projects.findFirst({
        where: and(eq(projects.id, input.projectId), eq(projects.orgId, input.orgId)),
      })
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' })

      const updates: Record<string, unknown> = { updatedBy: ctx.user.id, updatedAt: new Date() }
      if (input.name !== undefined) updates.name = input.name
      if (input.pictureUrl !== undefined) updates.pictureUrl = input.pictureUrl

      const [updated] = await ctx.db.update(projects)
        .set(updates)
        .where(eq(projects.id, input.projectId))
        .returning()

      return updated
    }),

  // Delete a project (Admin only)
  delete: orgProcedure
    .input(z.object({ orgId: z.string(), projectId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!isOrgRoleAtLeast(ctx.org.role as OrgRole, 'Admin')) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only owners or admins can delete projects' })
      }

      const project = await ctx.db.query.projects.findFirst({
        where: and(eq(projects.id, input.projectId), eq(projects.orgId, input.orgId)),
      })
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' })

      await ctx.db.delete(projects).where(eq(projects.id, input.projectId))
    }),
})
