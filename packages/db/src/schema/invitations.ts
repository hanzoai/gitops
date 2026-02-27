import { pgTable, text, timestamp, pgEnum } from 'drizzle-orm/pg-core'
import { createId } from '@paralleldrive/cuid2'
import { sql } from 'drizzle-orm'
import { organizations } from './organizations'
import { projects } from './projects'
import { users } from './users'

export const inviteStatusEnum = pgEnum('invite_status', ['Pending', 'Accepted', 'Rejected', 'Revoked'])
export const inviteTargetEnum = pgEnum('invite_target', ['organization', 'project'])

export const invitations = pgTable('invitations', {
  id:         text('id').primaryKey().$defaultFn(() => createId()),
  token:      text('token').notNull().unique(),
  email:      text('email').notNull(),
  targetType: inviteTargetEnum('target_type').notNull(),
  orgId:      text('org_id').references(() => organizations.id, { onDelete: 'cascade' }),
  projectId:  text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  projectIds: text('project_ids').array(),
  role:       text('role').notNull(),
  status:     inviteStatusEnum('status').notNull().default('Pending'),
  invitedBy:  text('invited_by').notNull().references(() => users.id),
  createdAt:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt:  timestamp('expires_at', { withTimezone: true }).notNull()
                .default(sql`now() + interval '7 days'`),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
})
