/**
 * tRPC router for DOKS cluster provisioning.
 *
 * Ported from platform/routes/provisioner.js to tRPC + TypeScript.
 */

import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, authedProcedure, orgProcedure, isOrgRoleAtLeast } from '../trpc'
import type { OrgRole } from '../trpc'
import { clusters } from '@paas/db/schema'
import { eq, and, isNotNull } from 'drizzle-orm'
import {
  createDOKSCluster,
  getDOKSCluster,
  getDOKSKubeconfig,
  deleteDOKSCluster,
  addNodePool,
  updateNodePool,
  deleteNodePool,
  upgradeToHA,
  listNodeSizes,
  listRegions,
  getDropletPricing,
} from '@paas/orchestrator/k8s/provisioner'

// ---------------------------------------------------------------------------
// Sub-router: node pool operations
// ---------------------------------------------------------------------------

const nodePoolRouter = router({
  add: orgProcedure
    .input(z.object({
      orgId: z.string(),
      clusterId: z.string(),
      name: z.string().min(1).max(64),
      size: z.string().optional(),
      count: z.number().int().min(1).max(100).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const cluster = await ctx.db.query.clusters.findFirst({
        where: and(eq(clusters.id, input.clusterId), eq(clusters.orgId, input.orgId)),
      })
      if (!cluster) throw new TRPCError({ code: 'NOT_FOUND', message: 'Cluster not found' })
      if (cluster.status !== 'running') {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Cluster not ready' })
      }
      if (!cluster.cloudId) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'No DOKS cluster ID' })
      }

      const pool = await addNodePool(cluster.cloudId, {
        name: input.name,
        size: input.size,
        count: input.count,
      })

      return pool
    }),

  scale: orgProcedure
    .input(z.object({
      orgId: z.string(),
      clusterId: z.string(),
      poolId: z.string(),
      count: z.number().int().min(1).max(100).optional(),
      size: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const cluster = await ctx.db.query.clusters.findFirst({
        where: and(eq(clusters.id, input.clusterId), eq(clusters.orgId, input.orgId)),
      })
      if (!cluster) throw new TRPCError({ code: 'NOT_FOUND', message: 'Cluster not found' })
      if (cluster.status !== 'running') {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Cluster not ready' })
      }
      if (!cluster.cloudId) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'No DOKS cluster ID' })
      }

      const pool = await updateNodePool(cluster.cloudId, input.poolId, {
        count: input.count,
        size: input.size,
      })

      return pool
    }),

  delete: orgProcedure
    .input(z.object({
      orgId: z.string(),
      clusterId: z.string(),
      poolId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const cluster = await ctx.db.query.clusters.findFirst({
        where: and(eq(clusters.id, input.clusterId), eq(clusters.orgId, input.orgId)),
      })
      if (!cluster) throw new TRPCError({ code: 'NOT_FOUND', message: 'Cluster not found' })
      if (cluster.status !== 'running') {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Cluster not ready' })
      }
      if (!cluster.cloudId) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'No DOKS cluster ID' })
      }

      await deleteNodePool(cluster.cloudId, input.poolId)
    }),
})

// ---------------------------------------------------------------------------
// Main provisioner router
// ---------------------------------------------------------------------------

export const provisionerRouter = router({
  // Provision a new DOKS cluster for an org
  provision: orgProcedure
    .input(z.object({
      orgId: z.string(),
      name: z.string().min(2).max(64),
      region: z.string().default('sfo3'),
      nodeSize: z.string().default('s-2vcpu-4gb'),
      nodeCount: z.number().int().min(1).max(100).default(2),
      ha: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!isOrgRoleAtLeast(ctx.org.role as OrgRole, 'Admin')) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only owners or admins can provision clusters' })
      }

      // Create local cluster record first (status: provisioning)
      const slug = `${input.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}-${Date.now().toString(36)}`
      const [clusterRecord] = await ctx.db.insert(clusters).values({
        slug,
        name: input.name,
        type: 'kubernetes',
        provider: 'digitalocean',
        status: 'provisioning',
        orgId: input.orgId,
        createdBy: ctx.user.id,
      }).returning()

      try {
        // Provision on DO
        const doksCluster = await createDOKSCluster({
          orgId: input.orgId,
          orgName: input.name,
          region: input.region,
          nodeSize: input.nodeSize,
          nodeCount: input.nodeCount,
          haControlPlane: input.ha,
        })

        // Update local record with DO cluster info
        const newStatus = doksCluster.status.state === 'running' ? 'running' : 'provisioning'
        await ctx.db.update(clusters)
          .set({
            status: newStatus,
            endpoint: doksCluster.endpoint,
            cloudId: doksCluster.id,
            cloudMeta: {
              region: doksCluster.region_slug,
              ha: doksCluster.ha,
              nodePools: doksCluster.node_pools.map(p => ({
                id: p.id,
                name: p.name,
                size: p.size,
                count: p.count,
                autoScale: p.auto_scale,
              })),
            },
          })
          .where(eq(clusters.id, clusterRecord.id))

        return {
          id: clusterRecord.id,
          cloudId: doksCluster.id,
          status: newStatus,
          endpoint: doksCluster.endpoint,
          region: doksCluster.region_slug,
          ha: doksCluster.ha,
          nodePools: doksCluster.node_pools,
        }
      } catch (err) {
        // Mark as error
        await ctx.db.update(clusters)
          .set({
            status: 'error',
            cloudMeta: { error: err instanceof Error ? err.message : String(err) },
          })
          .where(eq(clusters.id, clusterRecord.id))
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `DOKS provisioning failed: ${err instanceof Error ? err.message : String(err)}`,
        })
      }
    }),

  // Get provisioning status (polls DO API for live state)
  status: orgProcedure
    .input(z.object({
      orgId: z.string(),
      clusterId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const cluster = await ctx.db.query.clusters.findFirst({
        where: and(eq(clusters.id, input.clusterId), eq(clusters.orgId, input.orgId)),
      })
      if (!cluster) throw new TRPCError({ code: 'NOT_FOUND', message: 'Cluster not found' })
      if (!cluster.cloudId) {
        return {
          id: cluster.id,
          status: cluster.status,
          endpoint: cluster.endpoint,
        }
      }

      // Poll live state from DO
      const doksCluster = await getDOKSCluster(cluster.cloudId)
      const newStatus = doksCluster.status.state === 'running' ? 'running' : cluster.status

      // Update cached status if changed
      if (newStatus !== cluster.status) {
        await ctx.db.update(clusters)
          .set({
            status: newStatus,
            endpoint: doksCluster.endpoint,
            cloudMeta: {
              ...(cluster.cloudMeta as any ?? {}),
              region: doksCluster.region_slug,
              ha: doksCluster.ha,
              nodePools: doksCluster.node_pools.map(p => ({
                id: p.id,
                name: p.name,
                size: p.size,
                count: p.count,
                autoScale: p.auto_scale,
              })),
            },
          })
          .where(eq(clusters.id, cluster.id))
      }

      return {
        id: cluster.id,
        status: doksCluster.status,
        endpoint: doksCluster.endpoint,
        ha: doksCluster.ha,
        region: doksCluster.region_slug,
        version: doksCluster.version_slug,
        nodePools: doksCluster.node_pools,
        createdAt: doksCluster.created_at,
        maintenancePolicy: doksCluster.maintenance_policy,
      }
    }),

  // List all DOKS clusters across all accessible orgs
  fleet: authedProcedure.query(async ({ ctx }) => {
    const allClusters = await ctx.db.query.clusters.findMany({
      where: and(
        eq(clusters.provider, 'digitalocean'),
        isNotNull(clusters.cloudId),
      ),
    })

    return allClusters.map(c => ({
      id: c.id,
      name: c.name,
      orgId: c.orgId,
      status: c.status,
      endpoint: c.endpoint,
      cloudId: c.cloudId,
      cloudRegion: c.cloudRegion,
      cloudMeta: c.cloudMeta,
      createdAt: c.createdAt,
    }))
  }),

  // Available regions and node sizes
  options: authedProcedure.query(async () => {
    const [options, regions] = await Promise.all([
      listNodeSizes(),
      listRegions(),
    ])
    return { options, regions }
  }),

  // Pricing for a specific droplet size
  pricing: authedProcedure
    .input(z.object({ sizeSlug: z.string() }))
    .query(async ({ input }) => {
      const pricing = await getDropletPricing(input.sizeSlug)
      if (!pricing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: `No pricing for size '${input.sizeSlug}'` })
      }
      return pricing
    }),

  // Upgrade cluster to HA control plane
  upgradeHA: orgProcedure
    .input(z.object({
      orgId: z.string(),
      clusterId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!isOrgRoleAtLeast(ctx.org.role as OrgRole, 'Admin')) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only owners or admins can upgrade clusters' })
      }

      const cluster = await ctx.db.query.clusters.findFirst({
        where: and(eq(clusters.id, input.clusterId), eq(clusters.orgId, input.orgId)),
      })
      if (!cluster) throw new TRPCError({ code: 'NOT_FOUND', message: 'Cluster not found' })
      if (cluster.status !== 'running') {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Cluster not ready' })
      }
      if (!cluster.cloudId) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'No DOKS cluster ID' })
      }

      const meta = (cluster.cloudMeta as any) ?? {}
      if (meta.ha) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Cluster already has HA control plane' })
      }

      const doksCluster = await upgradeToHA(cluster.cloudId)

      await ctx.db.update(clusters)
        .set({
          cloudMeta: { ...meta, ha: true },
        })
        .where(eq(clusters.id, cluster.id))

      return { ha: true, cluster: doksCluster }
    }),

  // Destroy a DOKS cluster (dangerous)
  destroy: orgProcedure
    .input(z.object({
      orgId: z.string(),
      clusterId: z.string(),
      confirm: z.literal(true, {
        errorMap: () => ({ message: 'Pass confirm: true to delete. This destroys all workloads.' }),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!isOrgRoleAtLeast(ctx.org.role as OrgRole, 'Admin')) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only owners or admins can destroy clusters' })
      }

      const cluster = await ctx.db.query.clusters.findFirst({
        where: and(eq(clusters.id, input.clusterId), eq(clusters.orgId, input.orgId)),
      })
      if (!cluster) throw new TRPCError({ code: 'NOT_FOUND', message: 'Cluster not found' })
      if (!cluster.cloudId) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'No DOKS cluster to destroy' })
      }

      // Mark as deleting
      await ctx.db.update(clusters)
        .set({ status: 'destroying' })
        .where(eq(clusters.id, cluster.id))

      await deleteDOKSCluster(cluster.cloudId)

      // Remove cluster record
      await ctx.db.delete(clusters)
        .where(eq(clusters.id, cluster.id))
    }),

  // Kubeconfig retrieval
  kubeconfig: orgProcedure
    .input(z.object({
      orgId: z.string(),
      clusterId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const cluster = await ctx.db.query.clusters.findFirst({
        where: and(eq(clusters.id, input.clusterId), eq(clusters.orgId, input.orgId)),
      })
      if (!cluster) throw new TRPCError({ code: 'NOT_FOUND', message: 'Cluster not found' })
      if (!cluster.cloudId) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'No DOKS cluster ID' })
      }

      return getDOKSKubeconfig(cluster.cloudId)
    }),

  // Nested node-pool operations
  nodePool: nodePoolRouter,
})
