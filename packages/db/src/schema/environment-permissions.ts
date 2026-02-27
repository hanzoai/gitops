import { pgTable, text, timestamp, pgEnum } from 'drizzle-orm/pg-core'
import { createId } from '@paralleldrive/cuid2'
import { environments } from './environments'
import { deployments } from './deployments'
import { users } from './users'

export const approvalStatusEnum = pgEnum('approval_status', ['pending', 'approved', 'rejected'])

export const environmentApprovals = pgTable('environment_approvals', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  environmentId:   text('environment_id').notNull().references(() => environments.id, { onDelete: 'cascade' }),
  deploymentId:    text('deployment_id').references(() => deployments.id, { onDelete: 'cascade' }),
  requestedBy:     text('requested_by').notNull().references(() => users.id),
  status:          approvalStatusEnum('status').notNull().default('pending'),
  reviewedBy:      text('reviewed_by').references(() => users.id),
  reviewedAt:      timestamp('reviewed_at', { withTimezone: true }),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
