export { buildQueue, deployQueue, provisionQueue, monitorQueue, connection } from './queues'
export { createBuildWorker, type BuildJobData } from './workers/build'
export { createDeployWorker, type DeployJobData } from './workers/deploy'
export { createMonitorWorker, registerMonitorSchedule, type MonitorJobData } from './workers/monitor'

import type { Worker } from '@hanzo/mq'
import { createBuildWorker } from './workers/build'
import { createDeployWorker } from './workers/deploy'
import { createMonitorWorker, registerMonitorSchedule } from './workers/monitor'

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

  workers.push(build, deploy, monitor)

  // Register the repeatable monitor poll
  await registerMonitorSchedule()

  console.log('[jobs] All workers started: build, deploy, monitor')

  return {
    async close() {
      console.log('[jobs] Shutting down workers...')
      await Promise.all(workers.map((w) => w.close()))
      console.log('[jobs] All workers stopped')
    },
  }
}
