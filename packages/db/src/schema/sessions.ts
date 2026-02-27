import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { users } from './users'

// next-auth session storage in PostgreSQL
export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId:       text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires:      timestamp('expires', { withTimezone: true }).notNull(),
})

export const accounts = pgTable('accounts', {
  id:                text('id').primaryKey(),
  userId:            text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type:              text('type').notNull(),
  provider:          text('provider').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  refreshToken:      text('refresh_token'),
  accessToken:       text('access_token'),
  expiresAt:         timestamp('expires_at', { withTimezone: true }),
  tokenType:         text('token_type'),
  scope:             text('scope'),
  idToken:           text('id_token'),
  sessionState:      text('session_state'),
})
