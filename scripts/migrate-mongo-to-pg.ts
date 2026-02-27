#!/usr/bin/env npx tsx
/**
 * MongoDB -> PostgreSQL migration for Hanzo PaaS v2
 *
 * Reads legacy Mongoose collections and writes to the new Drizzle/PostgreSQL schema.
 *
 * Prerequisites:
 *   pnpm add -w mongodb @paralleldrive/cuid2 postgres
 *
 * Usage:
 *   MONGO_URI=mongodb://... DATABASE_URL=postgres://... npx tsx scripts/migrate-mongo-to-pg.ts
 *   MONGO_URI=mongodb://... DATABASE_URL=postgres://... npx tsx scripts/migrate-mongo-to-pg.ts --dry-run
 *
 * Env vars:
 *   MONGO_URI     - MongoDB connection string
 *   DATABASE_URL  - PostgreSQL connection string
 */

import { MongoClient, type Db, type Document, ObjectId } from 'mongodb'
import postgres from 'postgres'
import { createId } from '@paralleldrive/cuid2'

// ---- CLI flags ----

const DRY_RUN = process.argv.includes('--dry-run')
if (DRY_RUN) console.log('[migrate] DRY RUN mode -- no writes to PostgreSQL\n')

// ---- Connections ----

const MONGO_URI = process.env.MONGO_URI
const DATABASE_URL = process.env.DATABASE_URL

if (!MONGO_URI) { console.error('MONGO_URI env var is required'); process.exit(1) }
if (!DATABASE_URL) { console.error('DATABASE_URL env var is required'); process.exit(1) }

const mongoClient = new MongoClient(MONGO_URI)
const sql = postgres(DATABASE_URL, { max: 5 })

// ---- ID mapping ----
// Maps MongoDB ObjectId.toString() -> new cuid2 id

const idMap = new Map<string, string>()

function mapId(oid: unknown): string {
  if (!oid) return createId()
  const key = oid instanceof ObjectId ? oid.toHexString() : String(oid)
  const existing = idMap.get(key)
  if (existing) return existing
  const newId = createId()
  idMap.set(key, newId)
  return newId
}

/** Resolve an existing mapped ID, or return null if the source ref is missing. */
function resolveId(oid: unknown): string | null {
  if (!oid) return null
  const key = oid instanceof ObjectId ? oid.toHexString() : String(oid)
  return idMap.get(key) ?? null
}

// ---- Progress logging ----

function progress(table: string, count: number, total: number) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 100
  process.stdout.write(`\r  [${table}] ${count}/${total} (${pct}%)`)
  if (count === total) process.stdout.write('\n')
}

// ---- Migration functions ----

async function migrateUsers(mongo: Db): Promise<number> {
  const collection = mongo.collection('users')
  const docs = await collection.find({}).toArray()
  const total = docs.length
  console.log(`\n[migrate] users: ${total} documents`)

  let count = 0
  for (const doc of docs) {
    const id = mapId(doc._id)
    if (!DRY_RUN) {
      await sql`
        INSERT INTO users (id, iid, name, email, picture_url, color, provider, provider_user_id, status, is_cluster_owner, can_create_org, last_login_at, created_at, updated_at)
        VALUES (
          ${id},
          ${doc.iid ?? id},
          ${doc.name ?? null},
          ${doc.email ?? null},
          ${doc.pictureUrl ?? null},
          ${doc.color ?? null},
          ${doc.provider ?? 'hanzo'},
          ${doc.providerUserId ?? ''},
          ${mapUserStatus(doc.status)},
          ${doc.isClusterOwner ?? false},
          ${doc.canCreateOrg ?? false},
          ${doc.lastLoginAt ? new Date(doc.lastLoginAt) : null},
          ${doc.createdAt ? new Date(doc.createdAt) : new Date()},
          ${doc.updatedAt ? new Date(doc.updatedAt) : new Date()}
        )
        ON CONFLICT (id) DO NOTHING
      `
    }
    count++
    progress('users', count, total)
  }
  return total
}

function mapUserStatus(status: string | undefined): string {
  // Legacy statuses: Pending, Active, Deleted
  // PG enum: Active, Deleted
  if (status === 'Deleted') return 'Deleted'
  return 'Active'
}

async function migrateOrganizations(mongo: Db): Promise<number> {
  const collection = mongo.collection('organizations')
  const docs = await collection.find({}).toArray()
  const total = docs.length
  console.log(`\n[migrate] organizations: ${total} documents`)

  let count = 0
  for (const doc of docs) {
    const id = mapId(doc._id)
    const ownerUserId = resolveId(doc.ownerUserId)
    if (!ownerUserId) {
      console.warn(`\n  WARN: org ${doc.name} has no mapped owner, skipping`)
      count++
      progress('organizations', count, total)
      continue
    }

    if (!DRY_RUN) {
      await sql`
        INSERT INTO organizations (id, iid, name, picture_url, color, owner_user_id, is_cluster_entity, created_by, updated_by, created_at, updated_at)
        VALUES (
          ${id},
          ${doc.iid ?? id},
          ${doc.name},
          ${doc.pictureUrl ?? null},
          ${doc.color ?? null},
          ${ownerUserId},
          ${doc.isClusterEntity ?? false},
          ${resolveId(doc.createdBy)},
          ${resolveId(doc.updatedBy)},
          ${doc.createdAt ? new Date(doc.createdAt) : new Date()},
          ${doc.updatedAt ? new Date(doc.updatedAt) : new Date()}
        )
        ON CONFLICT (id) DO NOTHING
      `
    }
    count++
    progress('organizations', count, total)
  }
  return total
}

async function migrateOrgMembers(mongo: Db): Promise<number> {
  const collection = mongo.collection('organization_members')
  const docs = await collection.find({}).toArray()
  const total = docs.length
  console.log(`\n[migrate] org_members: ${total} documents`)

  let count = 0
  for (const doc of docs) {
    const id = mapId(doc._id)
    const orgId = resolveId(doc.orgId)
    const userId = resolveId(doc.userId)
    if (!orgId || !userId) {
      count++
      progress('org_members', count, total)
      continue
    }

    if (!DRY_RUN) {
      await sql`
        INSERT INTO org_members (id, org_id, user_id, role, joined_at)
        VALUES (
          ${id},
          ${orgId},
          ${userId},
          ${mapOrgRole(doc.role)},
          ${doc.joinDate ? new Date(doc.joinDate) : new Date()}
        )
        ON CONFLICT (id) DO NOTHING
      `
    }
    count++
    progress('org_members', count, total)
  }
  return total
}

function mapOrgRole(role: string | undefined): string {
  if (role === 'Admin') return 'Admin'
  return 'Member'
}

async function migrateProjects(mongo: Db): Promise<number> {
  const collection = mongo.collection('projects')
  const docs = await collection.find({}).toArray()
  const total = docs.length
  console.log(`\n[migrate] projects: ${total} documents`)

  let count = 0
  for (const doc of docs) {
    const id = mapId(doc._id)
    const orgId = resolveId(doc.orgId)
    const ownerUserId = resolveId(doc.ownerUserId)
    if (!orgId || !ownerUserId) {
      console.warn(`\n  WARN: project ${doc.name} missing org or owner ref, skipping`)
      count++
      progress('projects', count, total)
      continue
    }

    if (!DRY_RUN) {
      await sql`
        INSERT INTO projects (id, iid, org_id, owner_user_id, name, picture_url, color, is_cluster_entity, created_by, updated_by, created_at, updated_at)
        VALUES (
          ${id},
          ${doc.iid ?? id},
          ${orgId},
          ${ownerUserId},
          ${doc.name},
          ${doc.pictureUrl ?? null},
          ${doc.color ?? null},
          ${doc.isClusterEntity ?? false},
          ${resolveId(doc.createdBy)},
          ${resolveId(doc.updatedBy)},
          ${doc.createdAt ? new Date(doc.createdAt) : new Date()},
          ${doc.updatedAt ? new Date(doc.updatedAt) : new Date()}
        )
        ON CONFLICT (id) DO NOTHING
      `
    }
    count++
    progress('projects', count, total)
  }
  return total
}

async function migrateProjectMembers(mongo: Db): Promise<number> {
  // Project members are embedded in the project document as `team` array
  const collection = mongo.collection('projects')
  const docs = await collection.find({ 'team.0': { $exists: true } }).toArray()

  let total = 0
  for (const doc of docs) total += (doc.team?.length ?? 0)
  console.log(`\n[migrate] project_members: ${total} embedded records`)

  let count = 0
  for (const doc of docs) {
    const projectId = resolveId(doc._id)
    if (!projectId) continue

    for (const member of (doc.team ?? [])) {
      const userId = resolveId(member.userId)
      if (!userId) { count++; progress('project_members', count, total); continue }

      const id = createId()
      if (!DRY_RUN) {
        await sql`
          INSERT INTO project_members (id, project_id, user_id, role, joined_at)
          VALUES (
            ${id},
            ${projectId},
            ${userId},
            ${mapProjectRole(member.role)},
            ${member.joinDate ? new Date(member.joinDate) : new Date()}
          )
          ON CONFLICT (id) DO NOTHING
        `
      }
      count++
      progress('project_members', count, total)
    }
  }
  return total
}

function mapProjectRole(role: string | undefined): string {
  if (role === 'Admin') return 'Admin'
  if (role === 'Viewer') return 'Viewer'
  return 'Developer'
}

async function migrateEnvironments(mongo: Db): Promise<number> {
  const collection = mongo.collection('environments')
  const docs = await collection.find({}).toArray()
  const total = docs.length
  console.log(`\n[migrate] environments: ${total} documents`)

  let count = 0
  for (const doc of docs) {
    const id = mapId(doc._id)
    const orgId = resolveId(doc.orgId)
    const projectId = resolveId(doc.projectId)
    if (!orgId || !projectId) {
      count++
      progress('environments', count, total)
      continue
    }

    if (!DRY_RUN) {
      await sql`
        INSERT INTO environments (id, iid, org_id, project_id, name, private, read_only, is_cluster_entity, created_by, updated_by, created_at, updated_at)
        VALUES (
          ${id},
          ${doc.iid ?? id},
          ${orgId},
          ${projectId},
          ${doc.name},
          ${doc.private ?? false},
          ${doc.readOnly ?? true},
          ${doc.isClusterEntity ?? false},
          ${resolveId(doc.createdBy)},
          ${resolveId(doc.updatedBy)},
          ${doc.createdAt ? new Date(doc.createdAt) : new Date()},
          ${doc.updatedAt ? new Date(doc.updatedAt) : new Date()}
        )
        ON CONFLICT (id) DO NOTHING
      `
    }
    count++
    progress('environments', count, total)
  }
  return total
}

async function migrateClusters(mongo: Db): Promise<number> {
  // Legacy has a single "cluster" document (the platform cluster)
  const collection = mongo.collection('clusters')
  const docs = await collection.find({}).toArray()
  const total = docs.length
  console.log(`\n[migrate] clusters: ${total} documents`)

  let count = 0
  for (const doc of docs) {
    const id = mapId(doc._id)

    if (!DRY_RUN) {
      await sql`
        INSERT INTO clusters (id, slug, name, type, provider, status, endpoint, domains, ips, reverse_proxy_url, created_by, updated_by, created_at, updated_at)
        VALUES (
          ${id},
          ${doc.slug ?? id},
          ${doc.slug ?? 'default'},
          ${'kubernetes'},
          ${'bare-metal'},
          ${'running'},
          ${null},
          ${doc.domains ?? []},
          ${doc.ips ?? []},
          ${doc.reverseProxyURL ?? null},
          ${resolveId(doc.createdBy)},
          ${resolveId(doc.updatedBy)},
          ${doc.createdAt ? new Date(doc.createdAt) : new Date()},
          ${doc.updatedAt ? new Date(doc.updatedAt) : new Date()}
        )
        ON CONFLICT (id) DO NOTHING
      `
    }
    count++
    progress('clusters', count, total)
  }
  return total
}

async function migrateContainers(mongo: Db): Promise<number> {
  const collection = mongo.collection('containers')
  const docs = await collection.find({}).toArray()
  const total = docs.length
  console.log(`\n[migrate] containers: ${total} documents`)

  // We need a cluster ID for all containers. In the legacy system there is only one cluster.
  // Find the first mapped cluster ID.
  const clusterDoc = await mongo.collection('clusters').findOne({})
  const defaultClusterId = clusterDoc ? resolveId(clusterDoc._id) : null
  if (!defaultClusterId) {
    console.warn('  WARN: No cluster found in MongoDB -- containers will lack cluster_id')
  }

  let count = 0
  for (const doc of docs) {
    const id = mapId(doc._id)
    const orgId = resolveId(doc.orgId)
    const projectId = resolveId(doc.projectId)
    const environmentId = resolveId(doc.environmentId)

    if (!orgId || !projectId || !environmentId) {
      console.warn(`\n  WARN: container ${doc.name} missing hierarchy refs, skipping`)
      count++
      progress('containers', count, total)
      continue
    }

    // Transform nested Mongo sub-docs into JSONB-compatible objects
    const networking = transformNetworking(doc.networking)
    const podConfig = transformPodConfig(doc.podConfig)
    const storageConfig = transformStorageConfig(doc.storageConfig)
    const deploymentConfig = transformDeploymentConfig(doc.deploymentConfig)
    const statefulSetConfig = transformStatefulSetConfig(doc.statefulSetConfig)
    const cronJobConfig = transformCronJobConfig(doc.cronJobConfig)
    const probes = transformProbes(doc.probes)
    const repoConfig = transformRepoConfig(doc.repo)
    const registryConfig = transformRegistryConfig(doc.registry)
    const variables = (doc.variables ?? []).map((v: any) => ({ name: v.name ?? '', value: v.value ?? '' }))

    if (!DRY_RUN) {
      await sql`
        INSERT INTO containers (
          id, iid, slug, name, type,
          org_id, project_id, environment_id, cluster_id,
          source_type, repo_config, registry_config,
          networking, pod_config, storage_config,
          deployment_config, stateful_set_config, cron_job_config,
          probes, variables,
          template_name, template_version,
          status, pipeline_status,
          is_cluster_entity, created_by, updated_by, created_at, updated_at
        )
        VALUES (
          ${id}, ${doc.iid}, ${doc.slug}, ${doc.name}, ${doc.type},
          ${orgId}, ${projectId}, ${environmentId}, ${defaultClusterId},
          ${doc.repoOrRegistry ?? 'repo'},
          ${repoConfig ? JSON.stringify(repoConfig) : null}::jsonb,
          ${registryConfig ? JSON.stringify(registryConfig) : null}::jsonb,
          ${networking ? JSON.stringify(networking) : null}::jsonb,
          ${podConfig ? JSON.stringify(podConfig) : null}::jsonb,
          ${storageConfig ? JSON.stringify(storageConfig) : null}::jsonb,
          ${deploymentConfig ? JSON.stringify(deploymentConfig) : null}::jsonb,
          ${statefulSetConfig ? JSON.stringify(statefulSetConfig) : null}::jsonb,
          ${cronJobConfig ? JSON.stringify(cronJobConfig) : null}::jsonb,
          ${probes ? JSON.stringify(probes) : null}::jsonb,
          ${variables.length > 0 ? JSON.stringify(variables) : null}::jsonb,
          ${doc.template?.name ?? null},
          ${doc.template?.version ?? null},
          ${doc.status ? JSON.stringify(doc.status) : null}::jsonb,
          ${doc.pipelineStatus ?? null},
          ${doc.isClusterEntity ?? false},
          ${resolveId(doc.createdBy)},
          ${resolveId(doc.updatedBy)},
          ${doc.createdAt ? new Date(doc.createdAt) : new Date()},
          ${doc.updatedAt ? new Date(doc.updatedAt) : new Date()}
        )
        ON CONFLICT (id) DO NOTHING
      `
    }
    count++
    progress('containers', count, total)
  }
  return total
}

// ---- Container sub-doc transformers ----

function transformNetworking(n: Document | undefined) {
  if (!n) return null
  return {
    containerPort: n.containerPort ?? 8080,
    ingress: n.ingress ? {
      enabled: n.ingress.enabled ?? false,
      type: n.ingress.type ?? 'subdomain',
    } : undefined,
    customDomain: n.customDomain?.domain ?? undefined,
    tcpProxy: n.tcpProxy ? {
      enabled: n.tcpProxy.enabled ?? false,
      publicPort: n.tcpProxy.publicPort ?? undefined,
    } : undefined,
  }
}

function transformPodConfig(p: Document | undefined) {
  if (!p) return null
  // Legacy stores cpu in either millicores or cores with a type field.
  // PG schema expects millicores always.
  const cpuRequest = normalizeCpu(p.cpuRequest, p.cpuRequestType)
  const cpuLimit = normalizeCpu(p.cpuLimit, p.cpuLimitType)
  const memoryRequest = normalizeMemory(p.memoryRequest, p.memoryRequestType)
  const memoryLimit = normalizeMemory(p.memoryLimit, p.memoryLimitType)

  return {
    cpuRequest,
    cpuLimit,
    memoryRequest,
    memoryLimit,
    restartPolicy: p.restartPolicy ?? 'Always',
  }
}

function normalizeCpu(value: number | undefined, type: string | undefined): number {
  if (value === undefined) return 100
  if (type === 'cores') return Math.round(value * 1000)
  return value // already millicores
}

function normalizeMemory(value: number | undefined, type: string | undefined): number {
  if (value === undefined) return 128
  if (type === 'gibibyte') return Math.round(value * 1024)
  return value // already MiB
}

function transformStorageConfig(s: Document | undefined) {
  if (!s) return null
  let size = s.size ?? 1
  if (s.sizeType === 'mebibyte') size = Math.round(size / 1024 * 100) / 100
  // else gibibyte, which is what PG schema expects (GiB)

  return {
    enabled: s.enabled ?? false,
    size,
    mountPath: s.mountPath ?? undefined,
    storageClass: undefined, // legacy does not have this
  }
}

function transformDeploymentConfig(d: Document | undefined) {
  if (!d) return null
  return {
    replicas: d.desiredReplicas ?? 1,
    strategy: d.strategy ?? 'RollingUpdate',
    maxSurge: d.rollingUpdate?.maxSurge ?? 30,
    maxUnavailable: d.rollingUpdate?.maxUnavailable ?? 0,
    minReadySeconds: undefined,
  }
}

function transformStatefulSetConfig(s: Document | undefined) {
  if (!s) return null
  return {
    replicas: s.desiredReplicas ?? 1,
    podManagementPolicy: s.podManagementPolicy ?? 'OrderedReady',
    persistentVolumeClaimRetentionPolicy: s.persistentVolumeClaimRetentionPolicy
      ? {
          whenDeleted: s.persistentVolumeClaimRetentionPolicy.whenDeleted ?? 'Retain',
          whenScaled: s.persistentVolumeClaimRetentionPolicy.whenScaled ?? 'Delete',
        }
      : undefined,
  }
}

function transformCronJobConfig(c: Document | undefined) {
  if (!c) return null
  return {
    schedule: c.schedule ?? '0 * * * *',
    concurrencyPolicy: c.concurrencyPolicy ?? 'Allow',
    suspend: c.suspend ?? false,
    successfulJobsHistoryLimit: c.successfulJobsHistoryLimit ?? 5,
    failedJobsHistoryLimit: c.failedJobsHistoryLimit ?? 5,
  }
}

function transformProbes(p: Document | undefined) {
  if (!p) return null
  const result: Record<string, any> = {}
  for (const kind of ['startup', 'readiness', 'liveness'] as const) {
    const probe = p[kind]
    if (!probe) continue
    result[kind] = {
      enabled: probe.enabled ?? false,
      type: probe.checkMechanism ?? 'httpGet',
      httpPath: probe.httpPath ?? undefined,
      port: probe.httpPort ?? probe.tcpPort ?? undefined,
      command: probe.execCommand ? [probe.execCommand] : undefined,
      initialDelaySeconds: probe.initialDelaySeconds ?? 30,
      periodSeconds: probe.periodSeconds ?? 30,
      timeoutSeconds: probe.timeoutSeconds ?? 10,
      failureThreshold: probe.failureThreshold ?? 3,
      successThreshold: 1,
    }
  }
  return Object.keys(result).length > 0 ? result : null
}

function transformRepoConfig(r: Document | undefined) {
  if (!r) return null
  if (!r.url && !r.name) return null
  return {
    provider: r.type ?? undefined,
    url: r.url ?? undefined,
    branch: r.branch ?? undefined,
    path: r.path ?? '/',
    dockerfile: r.dockerfile ?? 'Dockerfile',
    gitProviderId: resolveId(r.gitProviderId) ?? undefined,
    webHookId: r.webHookId ?? undefined,
    watchPaths: r.watchPath ? [r.watchPath] : undefined,
    testEnabled: r.testEnabled ?? true,
    testImage: r.testImage ?? undefined,
    testCommand: r.testCommand ?? undefined,
  }
}

function transformRegistryConfig(r: Document | undefined) {
  if (!r) return null
  if (!r.imageName && !r.imageUrl) return null
  return {
    registryId: resolveId(r.registryId) ?? undefined,
    imageName: r.imageName ?? '',
    imageTag: r.imageTag ?? 'latest',
  }
}

async function migrateRegistries(mongo: Db): Promise<number> {
  const collection = mongo.collection('registries')
  const docs = await collection.find({}).toArray()
  const total = docs.length
  console.log(`\n[migrate] registries: ${total} documents`)

  let count = 0
  for (const doc of docs) {
    const id = mapId(doc._id)

    // Merge provider-specific credentials into a single JSONB column
    const credentials = doc.ecr ?? doc.acr ?? doc.gcp ?? doc.generic ?? null

    if (!DRY_RUN) {
      await sql`
        INSERT INTO registries (id, iid, type, name, credentials, is_cluster_entity, created_by, updated_by, created_at, updated_at)
        VALUES (
          ${id},
          ${doc.iid ?? id},
          ${doc.type},
          ${doc.name},
          ${credentials ? JSON.stringify(credentials) : null}::jsonb,
          ${doc.isClusterEntity ?? false},
          ${resolveId(doc.createdBy)},
          ${resolveId(doc.updatedBy)},
          ${doc.createdAt ? new Date(doc.createdAt) : new Date()},
          ${doc.updatedAt ? new Date(doc.updatedAt) : new Date()}
        )
        ON CONFLICT (id) DO NOTHING
      `
    }
    count++
    progress('registries', count, total)
  }
  return total
}

async function migrateGitProviders(mongo: Db): Promise<number> {
  const collection = mongo.collection('git_providers')
  const docs = await collection.find({}).toArray()
  const total = docs.length
  console.log(`\n[migrate] git_providers: ${total} documents`)

  let count = 0
  for (const doc of docs) {
    const id = mapId(doc._id)
    const userId = resolveId(doc.userId)
    if (!userId) { count++; progress('git_providers', count, total); continue }

    if (!DRY_RUN) {
      await sql`
        INSERT INTO git_providers (id, iid, user_id, provider, provider_user_id, access_token, refresh_token, expires_at, username, email, avatar, created_at, updated_at)
        VALUES (
          ${id},
          ${doc.iid ?? id},
          ${userId},
          ${doc.provider},
          ${doc.providerUserId ?? ''},
          ${doc.accessToken ?? ''},
          ${doc.refreshToken ?? null},
          ${doc.expiresAt ? new Date(doc.expiresAt) : null},
          ${doc.username ?? null},
          ${doc.email ?? null},
          ${doc.avatar ?? null},
          ${doc.createdAt ? new Date(doc.createdAt) : new Date()},
          ${doc.updatedAt ? new Date(doc.updatedAt) : new Date()}
        )
        ON CONFLICT (id) DO NOTHING
      `
    }
    count++
    progress('git_providers', count, total)
  }
  return total
}

async function migrateDeployments(_mongo: Db): Promise<number> {
  // Legacy system does not have a dedicated deployments collection.
  // Pipeline/taskrun data lives on the container doc (pipelineStatus).
  // We create a seed deployment row per container that has a pipelineStatus.
  const collection = _mongo.collection('containers')
  const docs = await collection.find({ pipelineStatus: { $exists: true, $ne: null } }).toArray()
  const total = docs.length
  console.log(`\n[migrate] deployments (from container pipelineStatus): ${total} records`)

  let count = 0
  for (const doc of docs) {
    const containerId = resolveId(doc._id)
    if (!containerId) { count++; progress('deployments', count, total); continue }

    const id = createId()
    const status = mapDeployStatus(doc.pipelineStatus)

    if (!DRY_RUN) {
      await sql`
        INSERT INTO deployments (id, container_id, status, trigger, created_at)
        VALUES (
          ${id},
          ${containerId},
          ${status},
          ${'manual'},
          ${doc.updatedAt ? new Date(doc.updatedAt) : new Date()}
        )
        ON CONFLICT (id) DO NOTHING
      `
    }
    count++
    progress('deployments', count, total)
  }
  return total
}

function mapDeployStatus(status: string | undefined): string {
  const valid = ['queued', 'building', 'pushing', 'deploying', 'running', 'failed', 'cancelled']
  if (status && valid.includes(status.toLowerCase())) return status.toLowerCase()
  return 'running'
}

async function migrateDomains(mongo: Db): Promise<number> {
  const collection = mongo.collection('domains')
  const docs = await collection.find({}).toArray()
  const total = docs.length
  console.log(`\n[migrate] domains: ${total} documents`)

  // Domains in legacy have no cluster reference. Link to the single legacy cluster.
  const clusterDoc = await mongo.collection('clusters').findOne({})
  const clusterId = clusterDoc ? resolveId(clusterDoc._id) : null

  let count = 0
  for (const doc of docs) {
    if (!clusterId) {
      console.warn('\n  WARN: no cluster found for domain mapping, skipping domains')
      break
    }

    const id = mapId(doc._id)
    if (!DRY_RUN) {
      await sql`
        INSERT INTO domains (id, domain, cluster_id, created_at)
        VALUES (
          ${id},
          ${doc.domain},
          ${clusterId},
          ${doc.createdAt ? new Date(doc.createdAt) : new Date()}
        )
        ON CONFLICT (id) DO NOTHING
      `
    }
    count++
    progress('domains', count, total)
  }
  return total
}

async function migrateAuditLogs(mongo: Db): Promise<number> {
  const collection = mongo.collection('audits')
  const docs = await collection.find({}).toArray()
  const total = docs.length
  console.log(`\n[migrate] audit_logs: ${total} documents`)

  let count = 0
  for (const doc of docs) {
    const id = mapId(doc._id)
    const userId = doc.actor?.userId ? resolveId(doc.actor.userId) : null

    // Map legacy fields to new schema
    const metadata: Record<string, unknown> = {}
    if (doc.orgId) metadata.orgId = resolveId(doc.orgId)
    if (doc.projectId) metadata.projectId = resolveId(doc.projectId)
    if (doc.environmentId) metadata.environmentId = resolveId(doc.environmentId)
    if (doc.containerId) metadata.containerId = resolveId(doc.containerId)
    if (doc.data) metadata.data = doc.data
    if (doc.actor) {
      metadata.actorName = doc.actor.name
      metadata.actorEmail = doc.actor.email
    }

    if (!DRY_RUN) {
      await sql`
        INSERT INTO audit_logs (id, user_id, action, resource, resource_id, description, metadata, created_at)
        VALUES (
          ${id},
          ${userId},
          ${doc.action ?? 'unknown'},
          ${doc.object ?? 'unknown'},
          ${doc.containerId ? resolveId(doc.containerId) : (doc.projectId ? resolveId(doc.projectId) : null)},
          ${doc.description ?? null},
          ${Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null}::jsonb,
          ${doc.createdAt ? new Date(doc.createdAt) : new Date()}
        )
        ON CONFLICT (id) DO NOTHING
      `
    }
    count++
    if (count % 100 === 0 || count === total) progress('audit_logs', count, total)
  }
  return total
}

async function migrateInvitations(mongo: Db): Promise<number> {
  // Legacy has two separate collections: organization_invitations and project_invitations
  // PG has a unified invitations table with target_type column

  let total = 0

  // -- Org invitations --
  const orgInvites = await mongo.collection('organization_invitations').find({}).toArray()
  const projInvites = await mongo.collection('project_invitations').find({}).toArray()
  total = orgInvites.length + projInvites.length
  console.log(`\n[migrate] invitations: ${total} documents (${orgInvites.length} org + ${projInvites.length} project)`)

  let count = 0

  for (const doc of orgInvites) {
    const id = mapId(doc._id)
    const orgId = resolveId(doc.orgId)
    const invitedBy = doc.host?.userId ? resolveId(doc.host.userId) : null

    if (!orgId || !invitedBy) { count++; progress('invitations', count, total); continue }

    if (!DRY_RUN) {
      await sql`
        INSERT INTO invitations (id, token, email, target_type, org_id, project_id, role, status, invited_by, created_at)
        VALUES (
          ${id},
          ${doc.token},
          ${doc.name ?? ''},
          ${'organization'},
          ${orgId},
          ${null},
          ${doc.role ?? 'Member'},
          ${mapInviteStatus(doc.status)},
          ${invitedBy},
          ${doc.createdAt ? new Date(doc.createdAt) : new Date()}
        )
        ON CONFLICT (id) DO NOTHING
      `
    }
    count++
    progress('invitations', count, total)
  }

  for (const doc of projInvites) {
    const id = mapId(doc._id)
    const orgId = resolveId(doc.orgId)
    const projectId = resolveId(doc.projectId)
    const invitedBy = doc.host?.userId ? resolveId(doc.host.userId) : null

    if (!invitedBy) { count++; progress('invitations', count, total); continue }

    if (!DRY_RUN) {
      await sql`
        INSERT INTO invitations (id, token, email, target_type, org_id, project_id, role, status, invited_by, created_at)
        VALUES (
          ${id},
          ${doc.token},
          ${doc.name ?? ''},
          ${'project'},
          ${orgId},
          ${projectId},
          ${doc.role ?? 'Developer'},
          ${mapInviteStatus(doc.status)},
          ${invitedBy},
          ${doc.createdAt ? new Date(doc.createdAt) : new Date()}
        )
        ON CONFLICT (id) DO NOTHING
      `
    }
    count++
    progress('invitations', count, total)
  }

  return total
}

function mapInviteStatus(status: string | undefined): string {
  if (status === 'Accepted') return 'Accepted'
  if (status === 'Rejected') return 'Rejected'
  return 'Pending'
}

// ---- Main ----

async function main() {
  console.log('=== Hanzo PaaS: MongoDB -> PostgreSQL Migration ===\n')
  const startTime = Date.now()

  await mongoClient.connect()
  console.log('[mongo] Connected')

  const mongo = mongoClient.db()

  // Verify PG connection
  const [{ now }] = await sql`SELECT now()`
  console.log(`[pg] Connected (server time: ${now})\n`)

  const counts: Record<string, number> = {}

  // Migrate in dependency order (parents before children)
  try {
    if (!DRY_RUN) {
      await sql`BEGIN`
    }

    counts.users = await migrateUsers(mongo)
    counts.organizations = await migrateOrganizations(mongo)
    counts.org_members = await migrateOrgMembers(mongo)
    counts.projects = await migrateProjects(mongo)
    counts.project_members = await migrateProjectMembers(mongo)
    counts.environments = await migrateEnvironments(mongo)
    counts.clusters = await migrateClusters(mongo)
    counts.registries = await migrateRegistries(mongo)
    counts.git_providers = await migrateGitProviders(mongo)
    counts.containers = await migrateContainers(mongo)
    counts.deployments = await migrateDeployments(mongo)
    counts.domains = await migrateDomains(mongo)
    counts.audit_logs = await migrateAuditLogs(mongo)
    counts.invitations = await migrateInvitations(mongo)

    if (!DRY_RUN) {
      await sql`COMMIT`
      console.log('\n[pg] Transaction committed')
    }
  } catch (err) {
    if (!DRY_RUN) {
      await sql`ROLLBACK`
      console.error('\n[pg] Transaction rolled back')
    }
    throw err
  }

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log('\n=== Migration Summary ===')
  console.log(`  Mode:     ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  console.log(`  Duration: ${elapsed}s`)
  console.log(`  ID maps:  ${idMap.size} ObjectId -> cuid2 mappings`)
  console.log('  Counts:')
  for (const [table, count] of Object.entries(counts)) {
    console.log(`    ${table.padEnd(20)} ${count}`)
  }
  console.log()

  await mongoClient.close()
  await sql.end()
  console.log('[done] Connections closed')
}

main().catch((err) => {
  console.error('\n[FATAL]', err)
  process.exit(1)
})
