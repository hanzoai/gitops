import { z } from 'zod'
import { router, authedProcedure } from '../trpc'
import { registries } from '@paas/db/schema'
import { eq } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { createId } from '@paralleldrive/cuid2'

export const registryRouter = router({
  // List all registries
  list: authedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.registries.findMany({
      where: eq(registries.createdBy, ctx.user.id),
    })
  }),

  // Add a new registry
  create: authedProcedure
    .input(z.object({
      name: z.string().min(2).max(64),
      type: z.enum(['ECR', 'ACR', 'GCR', 'GAR', 'Quay', 'GHCR', 'Docker', 'Custom', 'Public']),
      credentials: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const iid = `reg-${createId().slice(0, 12)}`

      const [registry] = await ctx.db.insert(registries).values({
        iid,
        name: input.name,
        type: input.type,
        credentials: input.credentials ?? null,
        createdBy: ctx.user.id,
      }).returning()

      return registry
    }),

  // Delete a registry
  delete: authedProcedure
    .input(z.object({ registryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const registry = await ctx.db.query.registries.findFirst({
        where: eq(registries.id, input.registryId),
      })
      if (!registry) throw new TRPCError({ code: 'NOT_FOUND' })
      if (registry.createdBy !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Can only delete your own registries' })
      }

      await ctx.db.delete(registries).where(eq(registries.id, input.registryId))
    }),

  // Test registry connectivity
  test: authedProcedure
    .input(z.object({
      type: z.enum(['ECR', 'ACR', 'GCR', 'GAR', 'Quay', 'GHCR', 'Docker', 'Custom', 'Public']),
      credentials: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Basic connectivity test: validate that credentials are structurally valid
      // Actual pull/push tests depend on registry type and would need external calls
      const requiredFields: Record<string, string[]> = {
        GHCR: ['username', 'token'],
        Docker: ['username', 'password'],
        ECR: ['accessKeyId', 'secretAccessKey', 'region'],
        ACR: ['loginServer', 'username', 'password'],
        GCR: ['serviceAccountKey'],
        GAR: ['serviceAccountKey', 'region'],
        Quay: ['username', 'token'],
        Custom: ['url', 'username', 'password'],
        Public: [],
      }

      const required = requiredFields[input.type] ?? []
      const creds = (input.credentials ?? {}) as Record<string, unknown>
      const missing = required.filter((f) => !creds[f])

      if (missing.length > 0) {
        return { ok: false, error: `Missing required fields: ${missing.join(', ')}` }
      }

      return { ok: true, error: null }
    }),
})
