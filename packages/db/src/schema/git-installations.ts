import { pgTable, text, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core'
import { createId } from '@paralleldrive/cuid2'
import { organizations } from './organizations'

export const gitInstallationProviderEnum = pgEnum('git_installation_provider', ['github', 'gitlab', 'bitbucket'])

export const gitInstallations = pgTable('git_installations', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  orgId:           text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  provider:        gitInstallationProviderEnum('provider').notNull(),
  installationId:  text('installation_id').notNull(),
  accountLogin:    text('account_login').notNull(),
  accountType:     text('account_type').notNull(),
  permissions:     jsonb('permissions'),
  events:          text('events').array(),
  accessToken:     text('access_token'),
  tokenExpiresAt:  timestamp('token_expires_at', { withTimezone: true }),
  suspendedAt:     timestamp('suspended_at', { withTimezone: true }),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
