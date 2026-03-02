import { pgTable, text, timestamp, boolean, unique } from 'drizzle-orm/pg-core'
import { createId } from '@paralleldrive/cuid2'
import { organizations } from './organizations'
import { gitInstallations } from './git-installations'
import { containers } from './containers'
import { projects } from './projects'

export const repositories = pgTable('repositories', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  installationId:  text('installation_id').notNull().references(() => gitInstallations.id, { onDelete: 'cascade' }),
  orgId:           text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  externalId:      text('external_id').notNull(),
  fullName:        text('full_name').notNull(),
  name:            text('name').notNull(),
  owner:           text('owner').notNull(),
  url:             text('url').notNull(),
  cloneUrl:        text('clone_url').notNull(),
  defaultBranch:   text('default_branch').notNull().default('main'),
  isPrivate:       boolean('is_private').notNull().default(false),
  language:        text('language'),
  description:     text('description'),
  topics:          text('topics').array(),
  ciStatus:        text('ci_status'),
  ciUrl:           text('ci_url'),
  lastPushAt:      timestamp('last_push_at', { withTimezone: true }),
  lastPushBranch:  text('last_push_branch'),
  lastCommitSha:   text('last_commit_sha'),
  lastCommitMsg:   text('last_commit_msg'),
  containerId:     text('container_id').references(() => containers.id, { onDelete: 'set null' }),
  projectId:       text('project_id').references(() => projects.id, { onDelete: 'set null' }),
  archivedAt:      timestamp('archived_at', { withTimezone: true }),
  syncedAt:        timestamp('synced_at', { withTimezone: true }),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueExternal: unique().on(t.installationId, t.externalId),
}))
