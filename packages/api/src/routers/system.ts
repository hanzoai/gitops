import { z } from 'zod'
import { router, publicProcedure, authedProcedure } from '../trpc'

export const systemRouter = router({
  health: publicProcedure.query(() => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
  })),

  whoami: authedProcedure.query(({ ctx }) => ({
    id: ctx.user.id,
    email: ctx.user.email,
    isClusterOwner: ctx.user.isClusterOwner,
    canCreateOrg: ctx.user.canCreateOrg,
  })),
})
