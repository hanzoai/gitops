import { z } from 'zod'
import { router, orgProcedure, projectProcedure } from '../trpc'
import { repositories, containers } from '@paas/db/schema'
import { eq, and, isNull, desc } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'

export const repositoryRouter = router({
  // List all repos for an org (with CI status, deploy link)
  list: orgProcedure
    .input(z.object({
      orgId: z.string(),
      search: z.string().optional(),
      language: z.string().optional(),
      ciStatus: z.enum(['success', 'failure', 'pending']).optional(),
      hasContainer: z.boolean().optional(),
      limit: z.number().min(1).max(200).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      // Build where conditions
      const conditions = [
        eq(repositories.orgId, input.orgId),
        isNull(repositories.archivedAt), // Exclude archived repos
      ]

      const results = await ctx.db.query.repositories.findMany({
        where: and(...conditions),
        orderBy: [desc(repositories.updatedAt)],
        limit: input.limit,
        offset: input.offset,
      })

      // Apply in-memory filters (drizzle doesn't have great dynamic where building)
      let filtered = results
      if (input.search) {
        const s = input.search.toLowerCase()
        filtered = filtered.filter(r =>
          r.fullName.toLowerCase().includes(s) ||
          r.name.toLowerCase().includes(s) ||
          (r.description?.toLowerCase().includes(s) ?? false)
        )
      }
      if (input.language) {
        filtered = filtered.filter(r => r.language === input.language)
      }
      if (input.ciStatus) {
        filtered = filtered.filter(r => r.ciStatus === input.ciStatus)
      }
      if (input.hasContainer === true) {
        filtered = filtered.filter(r => r.containerId != null)
      } else if (input.hasContainer === false) {
        filtered = filtered.filter(r => r.containerId == null)
      }

      return filtered
    }),

  // Get single repo with full details
  get: orgProcedure
    .input(z.object({
      orgId: z.string(),
      repositoryId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const repo = await ctx.db.query.repositories.findFirst({
        where: and(
          eq(repositories.id, input.repositoryId),
          eq(repositories.orgId, input.orgId),
        ),
      })
      if (!repo) throw new TRPCError({ code: 'NOT_FOUND' })
      return repo
    }),

  // Link a repo to a container
  link: projectProcedure
    .input(z.object({
      orgId: z.string(),
      projectId: z.string(),
      repositoryId: z.string(),
      containerId: z.string(),
      branch: z.string().default('main'),
      path: z.string().default('/'),
      dockerfile: z.string().default('Dockerfile'),
    }))
    .mutation(async ({ ctx, input }) => {
      const repo = await ctx.db.query.repositories.findFirst({
        where: eq(repositories.id, input.repositoryId),
      })
      if (!repo) throw new TRPCError({ code: 'NOT_FOUND', message: 'Repository not found' })

      const container = await ctx.db.query.containers.findFirst({
        where: eq(containers.id, input.containerId),
      })
      if (!container) throw new TRPCError({ code: 'NOT_FOUND', message: 'Container not found' })

      // Update repository -> link to container + project
      await ctx.db.update(repositories)
        .set({
          containerId: input.containerId,
          projectId: input.projectId,
          updatedAt: new Date(),
        })
        .where(eq(repositories.id, input.repositoryId))

      // Update container -> link to repository + set repoConfig
      await ctx.db.update(containers)
        .set({
          repositoryId: input.repositoryId,
          sourceType: 'repo',
          repoConfig: {
            provider: 'github',
            url: repo.cloneUrl,
            branch: input.branch,
            path: input.path,
            dockerfile: input.dockerfile,
          },
          updatedAt: new Date(),
        })
        .where(eq(containers.id, input.containerId))

      return { linked: true }
    }),

  // Unlink repo from container
  unlink: projectProcedure
    .input(z.object({
      orgId: z.string(),
      projectId: z.string(),
      repositoryId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const repo = await ctx.db.query.repositories.findFirst({
        where: eq(repositories.id, input.repositoryId),
      })
      if (!repo) throw new TRPCError({ code: 'NOT_FOUND' })

      // Unlink container
      if (repo.containerId) {
        await ctx.db.update(containers)
          .set({ repositoryId: null, updatedAt: new Date() })
          .where(eq(containers.id, repo.containerId))
      }

      // Unlink repository
      await ctx.db.update(repositories)
        .set({
          containerId: null,
          projectId: null,
          updatedAt: new Date(),
        })
        .where(eq(repositories.id, input.repositoryId))

      return { unlinked: true }
    }),

  // Get CI/CD runs for a repo (live from GitHub Actions API)
  ciRuns: orgProcedure
    .input(z.object({
      orgId: z.string(),
      repositoryId: z.string(),
      limit: z.number().min(1).max(50).default(10),
    }))
    .query(async ({ ctx, input }) => {
      const repo = await ctx.db.query.repositories.findFirst({
        where: and(
          eq(repositories.id, input.repositoryId),
          eq(repositories.orgId, input.orgId),
        ),
      })
      if (!repo) throw new TRPCError({ code: 'NOT_FOUND' })

      // Get installation for this repo
      const { gitInstallations } = await import('@paas/db/schema')
      const installation = await ctx.db.query.gitInstallations.findFirst({
        where: eq(gitInstallations.id, repo.installationId),
      })
      if (!installation) throw new TRPCError({ code: 'NOT_FOUND', message: 'Installation not found' })

      try {
        const { getInstallationOctokit } = await import('@paas/orchestrator/github/app')
        const octokit = getInstallationOctokit(Number(installation.installationId))

        const res = await octokit.request('GET /repos/{owner}/{repo}/actions/runs', {
          owner: repo.owner,
          repo: repo.name,
          per_page: input.limit,
        })

        const runs = (res.data as any).workflow_runs as Array<Record<string, unknown>>
        return (runs ?? []).map(run => ({
          id: run.id,
          name: run.name,
          status: run.status,
          conclusion: run.conclusion,
          branch: (run.head_branch as string) ?? null,
          commitSha: (run.head_sha as string) ?? null,
          commitMessage: (run.display_title as string) ?? null,
          url: run.html_url,
          createdAt: run.created_at,
          updatedAt: run.updated_at,
        }))
      } catch (err) {
        // If GitHub Actions not enabled, return empty
        return []
      }
    }),

  // Trigger manual sync for one repo
  sync: orgProcedure
    .input(z.object({
      orgId: z.string(),
      repositoryId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const repo = await ctx.db.query.repositories.findFirst({
        where: and(
          eq(repositories.id, input.repositoryId),
          eq(repositories.orgId, input.orgId),
        ),
      })
      if (!repo) throw new TRPCError({ code: 'NOT_FOUND' })

      const { syncQueue } = await import('@paas/jobs')
      await syncQueue.add('sync', {
        installationId: repo.installationId,
        fullSync: false,
      })

      return { queued: true }
    }),
})
