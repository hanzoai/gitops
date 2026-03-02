import { Worker, type Job } from '@hanzo/mq'
import { eq, and } from 'drizzle-orm'
import { db } from '@paas/db/client'
import { repositories, gitInstallations, deployments } from '@paas/db/schema'
import { connection, buildQueue } from '../queues'

export interface WebhookJobData {
  event: string
  installationId: string  // git_installations.id (our DB ID)
  payload: Record<string, unknown>
}

async function processWebhook(job: Job<WebhookJobData>): Promise<void> {
  const { event, installationId, payload } = job.data

  switch (event) {
    case 'push': {
      const repoFullName = (payload.repository as any)?.full_name as string
      if (!repoFullName) break

      const headCommit = payload.head_commit as any
      const ref = payload.ref as string
      const branch = ref?.replace('refs/heads/', '')

      // Update repository record
      const repo = await db.query.repositories.findFirst({
        where: and(
          eq(repositories.installationId, installationId),
          eq(repositories.fullName, repoFullName),
        ),
      })

      if (repo) {
        await db.update(repositories)
          .set({
            lastPushAt: new Date(),
            lastPushBranch: branch,
            lastCommitSha: headCommit?.id ?? null,
            lastCommitMsg: headCommit?.message ?? null,
            updatedAt: new Date(),
          })
          .where(eq(repositories.id, repo.id))

        // If repo is linked to a container, trigger build
        if (repo.containerId && branch === repo.defaultBranch) {
          const [deployment] = await db.insert(deployments).values({
            containerId: repo.containerId,
            status: 'queued',
            trigger: 'git-push',
            commitSha: headCommit?.id ?? null,
            commitMessage: headCommit?.message ?? null,
            branch,
          }).returning()

          await buildQueue.add('build', {
            deploymentId: deployment.id,
            containerId: repo.containerId,
          })

          console.log(`[webhook] Push to ${repoFullName}/${branch} -> triggered build ${deployment.id}`)
        }
      }
      break
    }

    case 'check_run':
    case 'check_suite': {
      const repoFullName = (payload.repository as any)?.full_name as string
      if (!repoFullName) break

      const checkData = event === 'check_run' ? payload.check_run : payload.check_suite
      const conclusion = (checkData as any)?.conclusion as string | null
      const htmlUrl = (checkData as any)?.html_url as string | null

      let ciStatus: string | null = null
      if (conclusion === 'success') ciStatus = 'success'
      else if (conclusion === 'failure' || conclusion === 'timed_out') ciStatus = 'failure'
      else if ((checkData as any)?.status === 'in_progress' || (checkData as any)?.status === 'queued') ciStatus = 'pending'

      if (ciStatus) {
        await db.update(repositories)
          .set({
            ciStatus,
            ciUrl: htmlUrl,
            updatedAt: new Date(),
          })
          .where(and(
            eq(repositories.installationId, installationId),
            eq(repositories.fullName, repoFullName),
          ))
      }
      break
    }

    case 'issue_comment': {
      const body = (payload.comment as any)?.body as string
      if (!body?.includes('@hanzo-dev')) break

      // TODO: Dispatch to bot handler
      // For now, log the mention
      const repoFullName = (payload.repository as any)?.full_name as string
      const issueNumber = (payload.issue as any)?.number
      console.log(`[webhook] @hanzo-dev mentioned in ${repoFullName}#${issueNumber}: ${body.slice(0, 100)}`)
      break
    }

    case 'pull_request': {
      const repoFullName = (payload.repository as any)?.full_name as string
      if (!repoFullName) break

      const pr = payload.pull_request as any
      const headSha = pr?.head?.sha as string
      const branch = pr?.head?.ref as string

      if (headSha) {
        await db.update(repositories)
          .set({
            lastCommitSha: headSha,
            lastPushBranch: branch,
            updatedAt: new Date(),
          })
          .where(and(
            eq(repositories.installationId, installationId),
            eq(repositories.fullName, repoFullName),
          ))
      }
      break
    }

    default:
      console.log(`[webhook] Unhandled event: ${event}`)
  }
}

export function createWebhookWorker(): Worker<WebhookJobData> {
  const worker = new Worker<WebhookJobData>('webhook', processWebhook, {
    connection,
    concurrency: 10,
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 1000 },
  })

  worker.on('failed', (job, err) => {
    console.error(`[webhook] Job ${job?.id} failed: ${err.message}`)
  })

  worker.on('completed', (job) => {
    console.log(`[webhook] Job ${job.id} completed (${job.data.event})`)
  })

  return worker
}
