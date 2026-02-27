import { z } from 'zod'
import { router, orgProcedure, isOrgRoleAtLeast } from '../trpc'
import type { OrgRole } from '../trpc'
import { auditLogs } from '@paas/db/schema'
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'

export const auditRouter = router({
  /**
   * List audit logs for an organization.
   * Supports pagination (offset/limit) and filtering by action, resourceType, date range.
   * Restricted to Admin and Owner roles.
   */
  list: orgProcedure
    .input(z.object({
      orgId: z.string(),
      // Pagination
      limit: z.number().int().min(1).max(200).default(50),
      offset: z.number().int().min(0).default(0),
      // Filters
      action: z.string().optional(),
      resourceType: z.string().optional(),
      resourceId: z.string().optional(),
      actorId: z.string().optional(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
    }))
    .query(async ({ ctx, input }) => {
      if (!isOrgRoleAtLeast(ctx.org.role as OrgRole, 'Admin')) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins and owners can view audit logs' })
      }

      // Build WHERE conditions
      const conditions = [eq(auditLogs.orgId, input.orgId)]

      if (input.action) {
        conditions.push(eq(auditLogs.action, input.action))
      }
      if (input.resourceType) {
        conditions.push(eq(auditLogs.resource, input.resourceType))
      }
      if (input.resourceId) {
        conditions.push(eq(auditLogs.resourceId, input.resourceId))
      }
      if (input.actorId) {
        conditions.push(eq(auditLogs.userId, input.actorId))
      }
      if (input.startDate) {
        conditions.push(gte(auditLogs.createdAt, new Date(input.startDate)))
      }
      if (input.endDate) {
        conditions.push(lte(auditLogs.createdAt, new Date(input.endDate)))
      }

      const where = and(...conditions)

      const [items, countResult] = await Promise.all([
        ctx.db
          .select()
          .from(auditLogs)
          .where(where)
          .orderBy(desc(auditLogs.createdAt))
          .limit(input.limit)
          .offset(input.offset),

        ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(auditLogs)
          .where(where),
      ])

      const total = countResult[0]?.count ?? 0

      return {
        items: items.map((row) => ({
          id: row.id,
          orgId: row.orgId,
          actorId: row.userId,
          action: row.action,
          resourceType: row.resource,
          resourceId: row.resourceId,
          description: row.description,
          metadata: row.metadata,
          ip: row.ip,
          userAgent: row.userAgent,
          createdAt: row.createdAt,
        })),
        total,
        limit: input.limit,
        offset: input.offset,
      }
    }),

  /**
   * Get a single audit log entry by ID.
   * Restricted to Admin and Owner roles.
   */
  get: orgProcedure
    .input(z.object({
      orgId: z.string(),
      id: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      if (!isOrgRoleAtLeast(ctx.org.role as OrgRole, 'Admin')) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins and owners can view audit logs' })
      }

      const row = await ctx.db.query.auditLogs.findFirst({
        where: and(eq(auditLogs.id, input.id), eq(auditLogs.orgId, input.orgId)),
      })

      if (!row) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Audit log entry not found' })
      }

      return {
        id: row.id,
        orgId: row.orgId,
        actorId: row.userId,
        action: row.action,
        resourceType: row.resource,
        resourceId: row.resourceId,
        description: row.description,
        metadata: row.metadata,
        ip: row.ip,
        userAgent: row.userAgent,
        createdAt: row.createdAt,
      }
    }),
})
