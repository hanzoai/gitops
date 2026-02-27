import { pgTable, text, timestamp, boolean } from 'drizzle-orm/pg-core'
import { createId } from '@paralleldrive/cuid2'
import { organizations } from './organizations'
import { users } from './users'

export const projects = pgTable('projects', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  iid:             text('iid').notNull().unique(),
  orgId:           text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  ownerUserId:     text('owner_user_id').notNull().references(() => users.id),
  name:            text('name').notNull(),
  pictureUrl:      text('picture_url'),
  color:           text('color'),
  isClusterEntity: boolean('is_cluster_entity').notNull().default(false),
  createdBy:       text('created_by').references(() => users.id),
  updatedBy:       text('updated_by').references(() => users.id),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
