export { buildQueue, deployQueue, provisionQueue, monitorQueue, webhookQueue, syncQueue, connection } from './queues'
export { createBuildWorker, type BuildJobData } from './workers/build'
export { createDeployWorker, type DeployJobData } from './workers/deploy'
export { createMonitorWorker, registerMonitorSchedule, type MonitorJobData } from './workers/monitor'
export { createWebhookWorker, type WebhookJobData } from './workers/webhook'
export { createSyncWorker, type SyncJobData } from './workers/sync'

import type { Worker } from '@hanzo/mq'
import { createBuildWorker } from './workers/build'
import { createDeployWorker } from './workers/deploy'
import { createMonitorWorker, registerMonitorSchedule } from './workers/monitor'
import { createWebhookWorker } from './workers/webhook'
import { createSyncWorker } from './workers/sync'

/**
 * Start all job workers and register repeatable schedules.
 * Call once in the worker process entrypoint.
 *
 * Returns handles for graceful shutdown.
 */
export async function startWorkers(): Promise<{ close: () => Promise<void> }> {
  const workers: Worker[] = []

  const build = createBuildWorker()
  const deploy = createDeployWorker()
  const monitor = createMonitorWorker()
  const webhook = createWebhookWorker()
  const sync = createSyncWorker()

  workers.push(build, deploy, monitor, webhook, sync)

  // Register the repeatable monitor poll
  await registerMonitorSchedule()

  console.log('[jobs] All workers started: build, deploy, monitor, webhook, sync')

  return {
    async close() {
      console.log('[jobs] Shutting down workers...')
      await Promise.all(workers.map((w) => w.close()))
      console.log('[jobs] All workers stopped')
    },
  }
}
