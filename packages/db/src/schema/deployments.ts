import { pgTable, text, timestamp, integer, jsonb, pgEnum } from 'drizzle-orm/pg-core'
import { createId } from '@paralleldrive/cuid2'
import { containers } from './containers'
import { users } from './users'

export const deployStatusEnum = pgEnum('deploy_status', [
  'queued', 'building', 'pushing', 'deploying', 'running', 'failed', 'cancelled',
])
export const triggerTypeEnum = pgEnum('trigger_type', [
  'manual', 'git-push', 'webhook', 'rollback', 'schedule',
])

export const deployments = pgTable('deployments', {
  id:            text('id').primaryKey().$defaultFn(() => createId()),
  containerId:   text('container_id').notNull().references(() => containers.id, { onDelete: 'cascade' }),
  status:        deployStatusEnum('status').notNull().default('queued'),
  trigger:       triggerTypeEnum('trigger').notNull().default('manual'),

  // Git info
  commitSha:     text('commit_sha'),
  commitMessage: text('commit_message'),
  branch:        text('branch'),

  // Build info
  imageTag:      text('image_tag'),
  buildLogs:     text('build_logs'),
  buildDuration: integer('build_duration'),       // seconds

  // Deploy info
  deployLogs:    text('deploy_logs'),
  deployMeta:    jsonb('deploy_meta'),            // orchestrator-specific metadata

  triggeredBy:   text('triggered_by').references(() => users.id),
  startedAt:     timestamp('started_at', { withTimezone: true }),
  finishedAt:    timestamp('finished_at', { withTimezone: true }),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
