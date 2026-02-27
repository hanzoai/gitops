import { pgTable, text, timestamp, pgEnum, unique } from 'drizzle-orm/pg-core'
import { createId } from '@paralleldrive/cuid2'
import { clusters } from './clusters'
import { users } from './users'

// Cluster-level access control:
//   'manage' — deploy + manage cluster settings
//   'deploy' — deploy containers only
//   'view'   — read-only status
// Org Admins/Owners bypass this table entirely (implicit full access).
export const clusterPermRoleEnum = pgEnum('cluster_perm_role', ['manage', 'deploy', 'view'])

export const clusterPermissions = pgTable('cluster_permissions', {
  id:        text('id').primaryKey().$defaultFn(() => createId()),
  clusterId: text('cluster_id').notNull().references(() => clusters.id, { onDelete: 'cascade' }),
  userId:    text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role:      clusterPermRoleEnum('role').notNull(),
  grantedBy: text('granted_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueClusterUser: unique('cluster_permissions_cluster_user').on(t.clusterId, t.userId),
}))
