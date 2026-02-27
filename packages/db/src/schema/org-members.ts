import { pgTable, text, timestamp, pgEnum } from 'drizzle-orm/pg-core'
import { createId } from '@paralleldrive/cuid2'
import { organizations } from './organizations'
import { users } from './users'

// 'Member' is deprecated (kept for pg compat — migrated to 'Developer' in data)
export const orgRoleEnum = pgEnum('org_role', ['Owner', 'Admin', 'Developer', 'Billing', 'Viewer', 'Member'])

export const orgMembers = pgTable('org_members', {
  id:       text('id').primaryKey().$defaultFn(() => createId()),
  orgId:    text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId:   text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role:     orgRoleEnum('role').notNull().default('Viewer'),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
})
