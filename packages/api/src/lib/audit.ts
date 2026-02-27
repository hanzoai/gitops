import { auditLogs } from '@paas/db/schema'
import type { Database } from '@paas/db'

/** Audit action types for RBAC and permission changes. */
export type AuditAction =
  | 'member.invited'
  | 'member.added'
  | 'member.removed'
  | 'member.role_changed'
  | 'cluster.permission_granted'
  | 'cluster.permission_revoked'
  | 'environment.protection_changed'
  | 'deploy.approved'
  | 'deploy.rejected'
  | 'owner.added'
  | 'owner.removed'
  // Legacy / general actions
  | 'container.create'
  | 'container.delete'
  | 'container.update'
  | 'cluster.provision'
  | (string & {})  // allow arbitrary strings while retaining autocomplete

/** Resource types tracked by audit logs. */
export type AuditResourceType =
  | 'organization'
  | 'project'
  | 'cluster'
  | 'environment'
  | 'container'
  | 'invitation'
  | (string & {})

export interface LogAuditParams {
  action: AuditAction
  resourceType: AuditResourceType
  resourceId: string
  actorId: string
  orgId: string
  metadata?: Record<string, unknown>
  description?: string
  ip?: string
  userAgent?: string
}

/**
 * Insert an audit log record.
 *
 * Maps semantic param names to the existing DB column names:
 *   actorId      -> userId
 *   resourceType -> resource
 */
export async function logAudit(db: Database, params: LogAuditParams): Promise<void> {
  await db.insert(auditLogs).values({
    orgId:      params.orgId,
    userId:     params.actorId,
    action:     params.action,
    resource:   params.resourceType,
    resourceId: params.resourceId,
    description: params.description,
    metadata:   params.metadata ?? null,
    ip:         params.ip,
    userAgent:  params.userAgent,
  })
}
