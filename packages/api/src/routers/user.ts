import { z } from 'zod'
import { router, authedProcedure } from '../trpc'
import { users } from '@paas/db/schema'
import { eq } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'

export const userRouter = router({
  // Get current user profile
  me: authedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.query.users.findFirst({
      where: eq(users.id, ctx.user.id),
    })
    if (!user) throw new TRPCError({ code: 'NOT_FOUND' })
    return user
  }),

  // Update name or avatar
  update: authedProcedure
    .input(z.object({
      name: z.string().min(1).max(128).optional(),
      pictureUrl: z.string().url().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const updates: Record<string, unknown> = { updatedAt: new Date() }
      if (input.name !== undefined) updates.name = input.name
      if (input.pictureUrl !== undefined) updates.pictureUrl = input.pictureUrl

      const [user] = await ctx.db.update(users)
        .set(updates)
        .where(eq(users.id, ctx.user.id))
        .returning()

      return user
    }),
})
