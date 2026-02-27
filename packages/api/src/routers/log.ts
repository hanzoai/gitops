import { z } from 'zod'
import { router, projectProcedure, getOrchestrator } from '../trpc'
import { containers, environments } from '@paas/db/schema'
import { eq } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'

export const logRouter = router({
  // Stream container logs via async generator (tRPC subscription)
  stream: projectProcedure
    .input(z.object({
      orgId: z.string(),
      projectId: z.string(),
      containerId: z.string(),
      tail: z.number().min(1).max(10000).default(100),
      follow: z.boolean().default(true),
    }))
    .subscription(async function* ({ ctx, input }) {
      const container = await ctx.db.query.containers.findFirst({
        where: eq(containers.id, input.containerId),
      })
      if (!container) throw new TRPCError({ code: 'NOT_FOUND', message: 'Container not found' })

      const env = await ctx.db.query.environments.findFirst({
        where: eq(environments.id, container.environmentId),
      })
      if (!env) throw new TRPCError({ code: 'NOT_FOUND', message: 'Environment not found' })

      const orch = await getOrchestrator(ctx.db, container.clusterId)
      const logStream = orch.streamLogs(env.iid, container.slug, {
        tail: input.tail,
        follow: input.follow,
      })

      for await (const line of logStream) {
        yield line
      }
    }),
})
