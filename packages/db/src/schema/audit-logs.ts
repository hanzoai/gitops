import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core'
import { createId } from '@paralleldrive/cuid2'
import { users } from './users'
import { organizations } from './organizations'

// Actions tracked by the audit system:
//   member.invited, member.added, member.removed, member.role_changed,
//   cluster.permission_granted, cluster.permission_revoked,
//   environment.protection_changed, deploy.approved, deploy.rejected,
//   owner.added, owner.removed,
//   container.create, container.delete, cluster.provision, ...
//
// Resource types: organization, project, cluster, environment, container, invitation

export const auditLogs = pgTable('audit_logs', {
  id:          text('id').primaryKey().$defaultFn(() => createId()),
  orgId:       text('org_id').references(() => organizations.id, { onDelete: 'cascade' }),
  userId:      text('user_id').references(() => users.id),  // actor who performed the action
  action:      text('action').notNull(),                     // e.g. 'member.role_changed'
  resource:    text('resource').notNull(),                   // e.g. 'organization', 'cluster'
  resourceId:  text('resource_id'),
  description: text('description'),
  metadata:    jsonb('metadata'),                            // { oldRole, newRole, targetUserId, ... }
  ip:          text('ip'),
  userAgent:   text('user_agent'),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
