import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { createId } from '@paralleldrive/cuid2'
import { clusters } from './clusters'

export const domains = pgTable('domains', {
  id:        text('id').primaryKey().$defaultFn(() => createId()),
  domain:    text('domain').notNull().unique(),
  clusterId: text('cluster_id').notNull().references(() => clusters.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
