import { Worker, type Job } from '@hanzo/mq'
import { eq, and, notInArray } from 'drizzle-orm'
import { db } from '@paas/db/client'
import { repositories, gitInstallations } from '@paas/db/schema'
import { connection } from '../queues'

export interface SyncJobData {
  installationId: string   // git_installations.id
  fullSync?: boolean
}

async function processSync(job: Job<SyncJobData>): Promise<void> {
  const { installationId } = job.data

  // 1. Load installation record
  const installation = await db.query.gitInstallations.findFirst({
    where: eq(gitInstallations.id, installationId),
  })
  if (!installation) throw new Error(`Installation not found: ${installationId}`)

  // 2. Get installation access token
  // Dynamic import to avoid loading octokit at module level
  const { getInstallationOctokit } = await import('@paas/orchestrator/github/app')
  const octokit = getInstallationOctokit(Number(installation.installationId))

  // 3. Paginate through all repos
  const seenExternalIds: string[] = []
  let page = 1
  const perPage = 100

  while (true) {
    const res = await octokit.request('GET /installation/repositories', {
      per_page: perPage,
      page,
    })

    const repos = (res.data as any).repositories as Array<Record<string, unknown>>
    if (!repos || repos.length === 0) break

    for (const repo of repos) {
      const externalId = String(repo.id)
      seenExternalIds.push(externalId)

      // UPSERT repository
      const existing = await db.query.repositories.findFirst({
        where: and(
          eq(repositories.installationId, installationId),
          eq(repositories.externalId, externalId),
        ),
      })

      const repoData = {
        installationId,
        orgId: installation.orgId,
        externalId,
        fullName: repo.full_name as string,
        name: repo.name as string,
        owner: (repo.owner as any)?.login as string ?? installation.accountLogin,
        url: repo.html_url as string,
        cloneUrl: repo.clone_url as string,
        defaultBranch: (repo.default_branch as string) ?? 'main',
        isPrivate: repo.private as boolean ?? false,
        language: repo.language as string ?? null,
        description: repo.description as string ?? null,
        topics: (repo.topics as string[]) ?? [],
        syncedAt: new Date(),
        updatedAt: new Date(),
      }

      if (existing) {
        await db.update(repositories)
          .set(repoData)
          .where(eq(repositories.id, existing.id))
      } else {
        await db.insert(repositories).values(repoData)
      }

      // 4. Fetch latest CI status (best-effort)
      try {
        const runsRes = await octokit.request('GET /repos/{owner}/{repo}/actions/runs', {
          owner: repoData.owner,
          repo: repoData.name,
          per_page: 1,
        })
        const runs = (runsRes.data as any).workflow_runs as Array<Record<string, unknown>>
        if (runs && runs.length > 0) {
          const latestRun = runs[0]
          let ciStatus: string | null = null
          if (latestRun.conclusion === 'success') ciStatus = 'success'
          else if (latestRun.conclusion === 'failure') ciStatus = 'failure'
          else if (latestRun.status === 'in_progress' || latestRun.status === 'queued') ciStatus = 'pending'

          await db.update(repositories)
            .set({
              ciStatus,
              ciUrl: latestRun.html_url as string,
            })
            .where(and(
              eq(repositories.installationId, installationId),
              eq(repositories.externalId, externalId),
            ))
        }
      } catch {
        // Actions may not be enabled on this repo -- skip
      }
    }

    if (repos.length < perPage) break
    page++
  }

  // 5. Mark repos not seen as archived
  if (seenExternalIds.length > 0) {
    await db.update(repositories)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(and(
        eq(repositories.installationId, installationId),
        notInArray(repositories.externalId, seenExternalIds),
      ))
  }

  console.log(`[sync] Synced ${seenExternalIds.length} repos for installation ${installation.accountLogin}`)
}

export function createSyncWorker(): Worker<SyncJobData> {
  const worker = new Worker<SyncJobData>('sync', processSync, {
    connection,
    concurrency: 3,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
  })

  worker.on('failed', (job, err) => {
    console.error(`[sync] Job ${job?.id} failed: ${err.message}`)
  })

  worker.on('completed', (job) => {
    console.log(`[sync] Job ${job.id} completed`)
  })

  return worker
}
