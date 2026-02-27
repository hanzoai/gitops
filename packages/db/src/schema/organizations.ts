import { pgTable, text, timestamp, boolean } from 'drizzle-orm/pg-core'
import { createId } from '@paralleldrive/cuid2'
import { users } from './users'

export const organizations = pgTable('organizations', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  iid:             text('iid').notNull().unique(),
  name:            text('name').notNull(),
  pictureUrl:      text('picture_url'),
  color:           text('color'),
  ownerUserId:     text('owner_user_id').notNull().references(() => users.id),
  isClusterEntity: boolean('is_cluster_entity').notNull().default(false),
  createdBy:       text('created_by').references(() => users.id),
  updatedBy:       text('updated_by').references(() => users.id),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
