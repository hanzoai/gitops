import { z } from 'zod'
import { router, projectProcedure, getOrchestrator } from '../trpc'
import { deployments, containers, environments } from '@paas/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'

export const buildRouter = router({
  // Manually trigger a build for a container
  trigger: projectProcedure
    .input(z.object({
      orgId: z.string(),
      projectId: z.string(),
      containerId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const container = await ctx.db.query.containers.findFirst({
        where: and(eq(containers.id, input.containerId), eq(containers.projectId, input.projectId)),
      })
      if (!container) throw new TRPCError({ code: 'NOT_FOUND', message: 'Container not found' })

      const env = await ctx.db.query.environments.findFirst({
        where: eq(environments.id, container.environmentId),
      })
      if (!env) throw new TRPCError({ code: 'NOT_FOUND', message: 'Environment not found' })

      // Create deployment record
      const [deployment] = await ctx.db.insert(deployments).values({
        containerId: input.containerId,
        status: 'queued',
        trigger: 'manual',
        triggeredBy: ctx.user.id,
      }).returning()

      // Trigger the build via orchestrator
      try {
        const orch = await getOrchestrator(ctx.db, container.clusterId)
        const repoConfig = container.repoConfig as Record<string, string> | null

        const registryConfig = container.registryConfig as Record<string, string> | null

        const buildResult = await orch.triggerBuild({
          containerId: container.id,
          namespace: env.iid,
          name: container.slug,
          repo: {
            url: repoConfig?.url,
            branch: repoConfig?.branch ?? 'main',
            path: repoConfig?.path ?? '/',
            dockerfile: repoConfig?.dockerfile ?? 'Dockerfile',
          },
          registry: registryConfig?.registryId ?? '',
          imageName: registryConfig?.imageName ?? container.slug,
        })

        await ctx.db.update(deployments)
          .set({
            status: 'building',
            imageTag: buildResult.imageTag,
            startedAt: new Date(),
          })
          .where(eq(deployments.id, deployment.id))

        return { ...deployment, status: 'building' as const, buildId: buildResult.buildId }
      } catch (err) {
        await ctx.db.update(deployments)
          .set({
            status: 'failed',
            buildLogs: err instanceof Error ? err.message : 'Build trigger failed',
            finishedAt: new Date(),
          })
          .where(eq(deployments.id, deployment.id))

        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to trigger build' })
      }
    }),

  // List build history for a container (from deployments table)
  list: projectProcedure
    .input(z.object({
      orgId: z.string(),
      projectId: z.string(),
      containerId: z.string(),
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.deployments.findMany({
        where: eq(deployments.containerId, input.containerId),
        orderBy: [desc(deployments.createdAt)],
        limit: input.limit,
        offset: input.offset,
      })
    }),

  // Get a single build's details + logs
  get: projectProcedure
    .input(z.object({
      orgId: z.string(),
      projectId: z.string(),
      deploymentId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const deployment = await ctx.db.query.deployments.findFirst({
        where: eq(deployments.id, input.deploymentId),
      })
      if (!deployment) throw new TRPCError({ code: 'NOT_FOUND' })
      return deployment
    }),

  // Cancel a running build
  cancel: projectProcedure
    .input(z.object({
      orgId: z.string(),
      projectId: z.string(),
      deploymentId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const deployment = await ctx.db.query.deployments.findFirst({
        where: eq(deployments.id, input.deploymentId),
      })
      if (!deployment) throw new TRPCError({ code: 'NOT_FOUND' })

      if (deployment.status !== 'queued' && deployment.status !== 'building') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Can only cancel queued or building deployments' })
      }

      // Cancel build via orchestrator if it has started
      const container = await ctx.db.query.containers.findFirst({
        where: eq(containers.id, deployment.containerId),
      })
      if (container) {
        try {
          const orch = await getOrchestrator(ctx.db, container.clusterId)
          await orch.cancelBuild(deployment.id)
        } catch {
          // Best-effort cancel
        }
      }

      const [updated] = await ctx.db.update(deployments)
        .set({ status: 'cancelled', finishedAt: new Date() })
        .where(eq(deployments.id, input.deploymentId))
        .returning()

      return updated
    }),
})
