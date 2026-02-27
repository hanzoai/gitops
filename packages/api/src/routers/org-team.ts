import { z } from 'zod'
import { router, orgProcedure, isOrgRoleAtLeast } from '../trpc'
import type { OrgRole } from '../trpc'
import { orgMembers, users } from '@paas/db/schema'
import { eq, and } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { ORG_ROLES } from '@paas/shared/constants'

export const orgTeamRouter = router({
  // List all members of an org
  list: orgProcedure
    .input(z.object({ orgId: z.string() }))
    .query(async ({ ctx, input }) => {
      const members = await ctx.db.query.orgMembers.findMany({
        where: eq(orgMembers.orgId, input.orgId),
      })

      // Hydrate with user info
      const userIds = members.map((m) => m.userId)
      const userList = await ctx.db.query.users.findMany({
        where: (u, { inArray }) => inArray(u.id, userIds),
      })
      const userMap = new Map(userList.map((u) => [u.id, u]))

      return members.map((m) => ({
        id: m.id,
        role: m.role,
        joinedAt: m.joinedAt,
        user: {
          id: m.userId,
          name: userMap.get(m.userId)?.name ?? null,
          email: userMap.get(m.userId)?.email ?? null,
          pictureUrl: userMap.get(m.userId)?.pictureUrl ?? null,
        },
      }))
    }),

  // Update a member's role
  // - Only Owners can promote/demote to/from Admin or Owner
  // - Admins can manage Developer/Billing/Viewer roles
  // - Nobody can set role to Owner here (use organization.transferOwnership)
  // - Cannot demote the last Owner
  updateRole: orgProcedure
    .input(z.object({
      orgId: z.string(),
      memberId: z.string(),
      role: z.enum(['Admin', 'Developer', 'Billing', 'Viewer']),
    }))
    .mutation(async ({ ctx, input }) => {
      const callerRole = ctx.org.role as OrgRole

      // Must be at least Admin to change any roles
      if (!isOrgRoleAtLeast(callerRole, 'Admin')) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only owners or admins can change member roles' })
      }

      const member = await ctx.db.query.orgMembers.findFirst({
        where: and(eq(orgMembers.id, input.memberId), eq(orgMembers.orgId, input.orgId)),
      })
      if (!member) throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' })

      const targetCurrentRole = member.role as OrgRole
      const targetNewRole = input.role as OrgRole

      // Only Owners can touch Admin-level roles
      if (callerRole !== 'Owner') {
        // Admin cannot promote to Admin
        if (isOrgRoleAtLeast(targetNewRole, 'Admin')) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Only owners can promote to Admin' })
        }
        // Admin cannot demote another Admin or Owner
        if (isOrgRoleAtLeast(targetCurrentRole, 'Admin')) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Only owners can demote admins or owners' })
        }
      }

      // Nobody can set Owner via updateRole (use transferOwnership instead)
      // (already enforced by the z.enum above, but be explicit)

      // Prevent demoting the last Owner
      if (targetCurrentRole === 'Owner') {
        const owners = await ctx.db.query.orgMembers.findMany({
          where: and(eq(orgMembers.orgId, input.orgId), eq(orgMembers.role, 'Owner')),
        })
        if (owners.length <= 1) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot demote the last owner' })
        }
      }

      const [updated] = await ctx.db.update(orgMembers)
        .set({ role: input.role })
        .where(eq(orgMembers.id, input.memberId))
        .returning()

      return updated
    }),

  // Remove a member from the org
  // - Owners can remove anyone (except the last Owner)
  // - Admins can remove Developer/Billing/Viewer only
  remove: orgProcedure
    .input(z.object({
      orgId: z.string(),
      memberId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const callerRole = ctx.org.role as OrgRole

      if (!isOrgRoleAtLeast(callerRole, 'Admin')) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only owners or admins can remove members' })
      }

      const member = await ctx.db.query.orgMembers.findFirst({
        where: and(eq(orgMembers.id, input.memberId), eq(orgMembers.orgId, input.orgId)),
      })
      if (!member) throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' })

      const targetRole = member.role as OrgRole

      // Admins cannot remove Owners or other Admins
      if (callerRole !== 'Owner' && isOrgRoleAtLeast(targetRole, 'Admin')) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only owners can remove admins or owners' })
      }

      // Cannot remove the last Owner
      if (targetRole === 'Owner') {
        const owners = await ctx.db.query.orgMembers.findMany({
          where: and(eq(orgMembers.orgId, input.orgId), eq(orgMembers.role, 'Owner')),
        })
        if (owners.length <= 1) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot remove the last owner' })
        }
      }

      await ctx.db.delete(orgMembers).where(eq(orgMembers.id, input.memberId))
    }),
})
