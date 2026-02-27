import { z } from 'zod'
import { router, authedProcedure, orgProcedure } from '../trpc'
import { invitations, orgMembers, projectMembers, users } from '@paas/db/schema'
import { eq, and } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { createId } from '@paralleldrive/cuid2'

const inviteRoleEnum = z.enum(['Admin', 'Developer', 'Billing', 'Viewer'])

function isPrivileged(role: string): boolean {
  return role === 'Admin' || role === 'Owner'
}

export const invitationRouter = router({
  // Create an invitation (Admin/Owner only)
  invite: orgProcedure
    .input(z.object({
      orgId: z.string(),
      email: z.string().email(),
      role: inviteRoleEnum,
      projectIds: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!isPrivileged(ctx.org.role)) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only Admins and Owners can invite members' })
      }

      // Check if there's already a pending invitation for this email+org
      const existing = await ctx.db.query.invitations.findFirst({
        where: and(
          eq(invitations.email, input.email),
          eq(invitations.orgId, input.orgId),
          eq(invitations.status, 'Pending'),
        ),
      })
      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'A pending invitation already exists for this email' })
      }

      // Check if user is already a member of this org
      const existingUser = await ctx.db.query.users.findFirst({
        where: eq(users.email, input.email),
      })
      if (existingUser) {
        const existingMember = await ctx.db.query.orgMembers.findFirst({
          where: and(
            eq(orgMembers.orgId, input.orgId),
            eq(orgMembers.userId, existingUser.id),
          ),
        })
        if (existingMember) {
          throw new TRPCError({ code: 'CONFLICT', message: 'User is already a member of this organization' })
        }
      }

      const token = createId()

      const [invitation] = await ctx.db.insert(invitations).values({
        token,
        email: input.email,
        targetType: 'organization',
        orgId: input.orgId,
        projectIds: input.projectIds ?? null,
        role: input.role,
        invitedBy: ctx.user.id,
      }).returning()

      // If the user already exists in the system, auto-accept
      if (existingUser) {
        await ctx.db.insert(orgMembers).values({
          orgId: input.orgId,
          userId: existingUser.id,
          role: input.role,
        })

        // Add to specified projects
        if (input.projectIds?.length) {
          const projectRole = input.role === 'Admin' ? 'Admin' : input.role === 'Viewer' ? 'Viewer' : 'Developer'
          await ctx.db.insert(projectMembers).values(
            input.projectIds.map((projectId) => ({
              projectId,
              userId: existingUser.id,
              role: projectRole as 'Admin' | 'Developer' | 'Viewer',
            })),
          )
        }

        // Mark invitation as accepted
        const now = new Date()
        const [updated] = await ctx.db.update(invitations)
          .set({ status: 'Accepted', acceptedAt: now })
          .where(eq(invitations.id, invitation.id))
          .returning()

        return { ...updated, autoAccepted: true }
      }

      return { ...invitation, autoAccepted: false }
    }),

  // Accept a pending invitation
  accept: authedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const invitation = await ctx.db.query.invitations.findFirst({
        where: and(
          eq(invitations.token, input.token),
          eq(invitations.status, 'Pending'),
        ),
      })
      if (!invitation) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Invitation not found or already used' })
      }

      // Check expiry
      if (invitation.expiresAt && new Date() > invitation.expiresAt) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invitation has expired' })
      }

      // Verify email matches the authenticated user
      if (invitation.email !== ctx.user.email) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'This invitation was sent to a different email address' })
      }

      if (!invitation.orgId) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Invitation is missing orgId' })
      }

      // Check if already a member (race condition guard)
      const existingMember = await ctx.db.query.orgMembers.findFirst({
        where: and(
          eq(orgMembers.orgId, invitation.orgId),
          eq(orgMembers.userId, ctx.user.id),
        ),
      })
      if (existingMember) {
        // Still mark the invitation as accepted
        const [updated] = await ctx.db.update(invitations)
          .set({ status: 'Accepted', acceptedAt: new Date() })
          .where(eq(invitations.id, invitation.id))
          .returning()
        return updated
      }

      // Create org membership — invitation role maps directly to org role
      await ctx.db.insert(orgMembers).values({
        orgId: invitation.orgId,
        userId: ctx.user.id,
        role: invitation.role as 'Admin' | 'Developer' | 'Billing' | 'Viewer',
      })

      // Create project memberships if projectIds were specified
      if (invitation.projectIds?.length) {
        const projectRole = invitation.role === 'Admin' ? 'Admin'
          : invitation.role === 'Viewer' ? 'Viewer'
          : 'Developer'

        await ctx.db.insert(projectMembers).values(
          invitation.projectIds.map((projectId) => ({
            projectId,
            userId: ctx.user.id,
            role: projectRole as 'Admin' | 'Developer' | 'Viewer',
          })),
        )
      }

      // Mark as accepted
      const now = new Date()
      const [updated] = await ctx.db.update(invitations)
        .set({ status: 'Accepted', acceptedAt: now })
        .where(eq(invitations.id, invitation.id))
        .returning()

      return updated
    }),

  // Reject a pending invitation
  reject: authedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const invitation = await ctx.db.query.invitations.findFirst({
        where: and(
          eq(invitations.token, input.token),
          eq(invitations.status, 'Pending'),
        ),
      })
      if (!invitation) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Invitation not found or already used' })
      }

      if (invitation.email !== ctx.user.email) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'This invitation was sent to a different email address' })
      }

      const [updated] = await ctx.db.update(invitations)
        .set({ status: 'Rejected' })
        .where(eq(invitations.id, invitation.id))
        .returning()

      return updated
    }),

  // Revoke a pending invitation (Admin/Owner only)
  revoke: orgProcedure
    .input(z.object({
      orgId: z.string(),
      invitationId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!isPrivileged(ctx.org.role)) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only Admins and Owners can revoke invitations' })
      }

      const invitation = await ctx.db.query.invitations.findFirst({
        where: and(
          eq(invitations.id, input.invitationId),
          eq(invitations.orgId, input.orgId),
          eq(invitations.status, 'Pending'),
        ),
      })
      if (!invitation) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Pending invitation not found' })
      }

      const [updated] = await ctx.db.update(invitations)
        .set({ status: 'Revoked' })
        .where(eq(invitations.id, invitation.id))
        .returning()

      return updated
    }),

  // List invitations for an org (with optional status filter)
  list: orgProcedure
    .input(z.object({
      orgId: z.string(),
      status: z.enum(['Pending', 'Accepted', 'Rejected', 'Revoked']).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const conditions = [eq(invitations.orgId, input.orgId)]
      if (input.status) {
        conditions.push(eq(invitations.status, input.status))
      }

      const results = await ctx.db.query.invitations.findMany({
        where: and(...conditions),
        orderBy: (inv, { desc }) => [desc(inv.createdAt)],
      })

      // Hydrate invitedBy with user info
      const inviterIds = [...new Set(results.map((r) => r.invitedBy))]
      const inviterList = inviterIds.length > 0
        ? await ctx.db.query.users.findMany({
            where: (u, { inArray }) => inArray(u.id, inviterIds),
          })
        : []
      const inviterMap = new Map(inviterList.map((u) => [u.id, u]))

      return results.map((inv) => ({
        ...inv,
        invitedByUser: {
          id: inv.invitedBy,
          name: inviterMap.get(inv.invitedBy)?.name ?? null,
          email: inviterMap.get(inv.invitedBy)?.email ?? null,
        },
      }))
    }),

  // List pending invitations for the current user
  listPending: authedProcedure.query(async ({ ctx }) => {
    if (!ctx.user.email) {
      return []
    }

    const results = await ctx.db.query.invitations.findMany({
      where: and(
        eq(invitations.email, ctx.user.email),
        eq(invitations.status, 'Pending'),
      ),
      orderBy: (inv, { desc }) => [desc(inv.createdAt)],
    })

    return results
  }),
})
