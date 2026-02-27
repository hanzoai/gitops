import { pgTable, text, timestamp, pgEnum } from 'drizzle-orm/pg-core'
import { createId } from '@paralleldrive/cuid2'
import { users } from './users'

export const gitProviderEnum = pgEnum('git_provider_type', ['github', 'gitlab', 'bitbucket'])

export const gitProviders = pgTable('git_providers', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  iid:             text('iid').notNull().unique(),
  userId:          text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider:        gitProviderEnum('provider').notNull(),
  providerUserId:  text('provider_user_id').notNull(),
  accessToken:     text('access_token').notNull(),          // encrypted
  refreshToken:    text('refresh_token'),                   // encrypted
  expiresAt:       timestamp('expires_at', { withTimezone: true }),
  username:        text('username'),
  email:           text('email'),
  avatar:          text('avatar'),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
