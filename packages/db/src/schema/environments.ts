import { pgTable, text, timestamp, boolean, pgEnum } from 'drizzle-orm/pg-core'
import { createId } from '@paralleldrive/cuid2'
import { organizations } from './organizations'
import { projects } from './projects'
import { users } from './users'

export const protectionLevelEnum = pgEnum('protection_level', ['none', 'restricted', 'locked'])

export const environments = pgTable('environments', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  iid:             text('iid').notNull().unique(),         // also used as K8s namespace name
  orgId:           text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  projectId:       text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name:            text('name').notNull(),
  private:         boolean('private').notNull().default(false),
  readOnly:        boolean('read_only').notNull().default(true),
  isClusterEntity: boolean('is_cluster_entity').notNull().default(false),

  // Environment protection — controls who can deploy
  // 'none':       anyone with project access can deploy
  // 'restricted': only Admin/Owner can deploy
  // 'locked':     only Owner can deploy (e.g., production)
  protectionLevel: protectionLevelEnum('protection_level').notNull().default('none'),
  approvalRequired: boolean('approval_required').notNull().default(false),
  allowedUserIds:  text('allowed_user_ids').array(),       // optional allowlist of user IDs who can deploy even if restricted

  createdBy:       text('created_by').references(() => users.id),
  updatedBy:       text('updated_by').references(() => users.id),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
