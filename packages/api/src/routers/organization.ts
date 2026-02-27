import { z } from 'zod'
import { router, authedProcedure, orgProcedure, isOrgRoleAtLeast } from '../trpc'
import type { OrgRole } from '../trpc'
import { organizations, orgMembers } from '@paas/db/schema'
import { eq, and } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { createId } from '@paralleldrive/cuid2'

export const organizationRouter = router({
  // List all orgs the current user belongs to
  list: authedProcedure.query(async ({ ctx }) => {
    const memberships = await ctx.db.query.orgMembers.findMany({
      where: eq(orgMembers.userId, ctx.user.id),
    })
    if (memberships.length === 0) return []

    const orgIds = memberships.map((m) => m.orgId)
    const orgs = await ctx.db.query.organizations.findMany({
      where: (org, { inArray }) => inArray(org.id, orgIds),
    })

    // Attach role to each org
    return orgs.map((org) => ({
      ...org,
      role: memberships.find((m) => m.orgId === org.id)!.role,
    }))
  }),

  // Get a single org by id (must be a member)
  get: orgProcedure
    .input(z.object({ orgId: z.string() }))
    .query(async ({ ctx, input }) => {
      const org = await ctx.db.query.organizations.findFirst({
        where: eq(organizations.id, input.orgId),
      })
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' })
      return { ...org, role: ctx.org.role }
    }),

  // Create a new organization
  create: authedProcedure
    .input(z.object({
      name: z.string().min(2).max(64),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.canCreateOrg) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'User is not allowed to create organizations' })
      }

      const iid = `org-${createId().slice(0, 12)}`

      const [org] = await ctx.db.insert(organizations).values({
        iid,
        name: input.name,
        ownerUserId: ctx.user.id,
        createdBy: ctx.user.id,
      }).returning()

      // Add creator as Owner member
      await ctx.db.insert(orgMembers).values({
        orgId: org.id,
        userId: ctx.user.id,
        role: 'Owner',
      })

      return org
    }),

  // Update org name or picture (Owner or Admin)
  update: orgProcedure
    .input(z.object({
      orgId: z.string(),
      name: z.string().min(2).max(64).optional(),
      pictureUrl: z.string().url().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!isOrgRoleAtLeast(ctx.org.role as OrgRole, 'Admin')) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only owners or admins can update the organization' })
      }

      const updates: Record<string, unknown> = { updatedBy: ctx.user.id, updatedAt: new Date() }
      if (input.name !== undefined) updates.name = input.name
      if (input.pictureUrl !== undefined) updates.pictureUrl = input.pictureUrl

      const [org] = await ctx.db.update(organizations)
        .set(updates)
        .where(eq(organizations.id, input.orgId))
        .returning()

      return org
    }),

  // Delete an organization (Owner only, cascades via FK)
  delete: orgProcedure
    .input(z.object({ orgId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.org.role !== 'Owner') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only owners can delete the organization' })
      }

      await ctx.db.delete(organizations).where(eq(organizations.id, input.orgId))
    }),

  // Transfer ownership: add another user as Owner (Owner only)
  transferOwnership: orgProcedure
    .input(z.object({
      orgId: z.string(),
      userId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.org.role !== 'Owner') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only owners can transfer ownership' })
      }

      // Target must already be a member of the org
      const member = await ctx.db.query.orgMembers.findFirst({
        where: and(eq(orgMembers.orgId, input.orgId), eq(orgMembers.userId, input.userId)),
      })
      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User is not a member of this organization' })
      }
      if (member.role === 'Owner') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'User is already an owner' })
      }

      const [updated] = await ctx.db.update(orgMembers)
        .set({ role: 'Owner' })
        .where(eq(orgMembers.id, member.id))
        .returning()

      return updated
    }),

  // Remove an owner (Owner only, must keep at least 1 owner)
  removeOwner: orgProcedure
    .input(z.object({
      orgId: z.string(),
      userId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.org.role !== 'Owner') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only owners can remove other owners' })
      }

      const member = await ctx.db.query.orgMembers.findFirst({
        where: and(eq(orgMembers.orgId, input.orgId), eq(orgMembers.userId, input.userId)),
      })
      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User is not a member of this organization' })
      }
      if (member.role !== 'Owner') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'User is not an owner' })
      }

      // Must keep at least 1 owner
      const owners = await ctx.db.query.orgMembers.findMany({
        where: and(eq(orgMembers.orgId, input.orgId), eq(orgMembers.role, 'Owner')),
      })
      if (owners.length <= 1) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot remove the last owner' })
      }

      // Demote to Admin
      const [updated] = await ctx.db.update(orgMembers)
        .set({ role: 'Admin' })
        .where(eq(orgMembers.id, member.id))
        .returning()

      return updated
    }),
})
