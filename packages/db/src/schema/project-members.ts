import { pgTable, text, timestamp, pgEnum } from 'drizzle-orm/pg-core'
import { createId } from '@paralleldrive/cuid2'
import { projects } from './projects'
import { users } from './users'

export const projectRoleEnum = pgEnum('project_role', ['Owner', 'Admin', 'Developer', 'Viewer'])

export const projectMembers = pgTable('project_members', {
  id:        text('id').primaryKey().$defaultFn(() => createId()),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId:    text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role:      projectRoleEnum('role').notNull().default('Developer'),
  joinedAt:  timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
})
