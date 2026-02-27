import { pgTable, text, timestamp, boolean, pgEnum } from 'drizzle-orm/pg-core'
import { createId } from '@paralleldrive/cuid2'

export const userStatusEnum = pgEnum('user_status', ['Active', 'Deleted'])

export const users = pgTable('users', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  iid:             text('iid').notNull().unique(),
  name:            text('name'),
  email:           text('email'),
  pictureUrl:      text('picture_url'),
  color:           text('color'),
  provider:        text('provider').notNull(),              // hanzo | github | gitlab | bitbucket
  providerUserId:  text('provider_user_id').notNull(),
  status:          userStatusEnum('status').notNull().default('Active'),
  isClusterOwner:  boolean('is_cluster_owner').notNull().default(false),
  canCreateOrg:    boolean('can_create_org').notNull().default(false),
  lastLoginAt:     timestamp('last_login_at', { withTimezone: true }),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
