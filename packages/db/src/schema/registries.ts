import { pgTable, text, timestamp, boolean, jsonb, pgEnum } from 'drizzle-orm/pg-core'
import { createId } from '@paralleldrive/cuid2'
import { users } from './users'

export const registryTypeEnum = pgEnum('registry_type', [
  'ECR', 'ACR', 'GCR', 'GAR', 'Quay', 'GHCR', 'Docker', 'Custom', 'Public',
])

export const registries = pgTable('registries', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  iid:             text('iid').notNull().unique(),
  type:            registryTypeEnum('type').notNull(),
  name:            text('name').notNull(),
  credentials:     jsonb('credentials'),    // encrypted, shape varies by type
  isClusterEntity: boolean('is_cluster_entity').notNull().default(false),
  createdBy:       text('created_by').references(() => users.id),
  updatedBy:       text('updated_by').references(() => users.id),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
