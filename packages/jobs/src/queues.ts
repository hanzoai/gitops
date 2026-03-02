import { Queue, Worker } from '@hanzo/mq'

const kvUrl = process.env.KV_URL ?? 'redis://localhost:6379'
const url = new URL(kvUrl.replace('redis://', 'http://'))

export const connection = {
  host: url.hostname,
  port: parseInt(url.port || '6379'),
}

// Build queue: docker build / kaniko build
export const buildQueue = new Queue('build', { connection })

// Deploy queue: create/update container on orchestrator
export const deployQueue = new Queue('deploy', { connection })

// Provision queue: DOKS / cloud cluster lifecycle
export const provisionQueue = new Queue('provision', { connection })

// Monitor queue: periodic health checks
export const monitorQueue = new Queue('monitor', { connection })

// Webhook queue: process GitHub/GitLab webhook events
export const webhookQueue = new Queue('webhook', { connection })

// Sync queue: full repository sync from provider API
export const syncQueue = new Queue('sync', { connection })
