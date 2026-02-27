/**
 * DigitalOcean Kubernetes (DOKS) cluster provisioner.
 *
 * Ported from platform/handlers/provisioner.js to ESM TypeScript.
 * Uses native fetch for DO API calls. No external HTTP dependencies.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DOKSCluster {
  id: string
  name: string
  region_slug: string
  version_slug: string
  status: { state: string; message?: string }
  endpoint: string
  ha: boolean
  auto_upgrade: boolean
  surge_upgrade: boolean
  node_pools: DOKSNodePool[]
  maintenance_policy: { start_time: string; day: string }
  created_at: string
  updated_at: string
  tags: string[]
}

export interface DOKSNodePool {
  id: string
  name: string
  size: string
  count: number
  auto_scale: boolean
  min_nodes: number
  max_nodes: number
  tags: string[]
  nodes?: DOKSNode[]
}

export interface DOKSNode {
  id: string
  name: string
  status: { state: string }
  created_at: string
  updated_at: string
}

export interface CreateClusterOpts {
  orgId: string
  orgName: string
  region?: string
  nodeSize?: string
  nodeCount?: number
  haControlPlane?: boolean
}

export interface AddNodePoolOpts {
  name: string
  size?: string
  count?: number
}

export interface UpdateNodePoolOpts {
  count?: number
  size?: string
}

export interface DOKSOptions {
  sizes: Array<{ name: string; slug: string }>
  regions: Array<{ name: string; slug: string }>
  versions: Array<{ slug: string; kubernetes_version: string }>
}

export interface DOKSRegion {
  slug: string
  name: string
  available: boolean
  features: string[]
  sizes: string[]
}

export interface DropletPricing {
  slug: string
  priceMonthly: number
  priceHourly: number
  vcpus: number
  memory: number
  disk: number
  description: string
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DO_API = 'https://api.digitalocean.com/v2'

function getToken(): string {
  const token = process.env.DO_API_TOKEN
  if (!token) throw new Error('DO_API_TOKEN not configured')
  return token
}

const DEFAULT_REGION = process.env.DO_DEFAULT_REGION || 'sfo3'
const DEFAULT_K8S_VERSION = process.env.DO_K8S_VERSION || '1.34.1-do.3'
const DEFAULT_NODE_SIZE = process.env.DO_DEFAULT_NODE_SIZE || 's-2vcpu-4gb'
const DEFAULT_NODE_COUNT = 2

// ---------------------------------------------------------------------------
// Internal fetch helper
// ---------------------------------------------------------------------------

async function doFetch<T>(
  path: string,
  opts: { method?: string; body?: unknown; responseType?: 'json' | 'text' } = {},
): Promise<T> {
  const { method = 'GET', body, responseType = 'json' } = opts
  const token = getToken()

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }

  const res = await fetch(`${DO_API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`DO API ${method} ${path} failed (${res.status}): ${text}`)
  }

  // 204 No Content
  if (res.status === 204) return undefined as T

  if (responseType === 'text') return (await res.text()) as T
  return (await res.json()) as T
}

// ---------------------------------------------------------------------------
// Cluster lifecycle
// ---------------------------------------------------------------------------

export async function createDOKSCluster(opts: CreateClusterOpts): Promise<DOKSCluster> {
  const {
    orgId,
    orgName,
    region = DEFAULT_REGION,
    nodeSize = DEFAULT_NODE_SIZE,
    nodeCount = DEFAULT_NODE_COUNT,
    haControlPlane = false,
  } = opts

  const slug = `hanzo-${orgName.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 40)}`

  const body = {
    name: slug,
    region,
    version: DEFAULT_K8S_VERSION,
    ha: haControlPlane,
    node_pools: [
      {
        size: nodeSize,
        name: `${slug}-pool`,
        count: nodeCount,
        auto_scale: true,
        min_nodes: 1,
        max_nodes: Math.max(nodeCount * 3, 6),
      },
    ],
    auto_upgrade: true,
    surge_upgrade: true,
    maintenance_policy: {
      start_time: '04:00',
      day: 'sunday',
    },
    tags: [`org:${orgId}`, 'hanzo-managed', 'paas'],
  }

  const data = await doFetch<{ kubernetes_cluster: DOKSCluster }>(
    '/kubernetes/clusters',
    { method: 'POST', body },
  )
  return data.kubernetes_cluster
}

export async function getDOKSCluster(clusterId: string): Promise<DOKSCluster> {
  const data = await doFetch<{ kubernetes_cluster: DOKSCluster }>(
    `/kubernetes/clusters/${clusterId}`,
  )
  return data.kubernetes_cluster
}

export async function getDOKSKubeconfig(clusterId: string): Promise<string> {
  return doFetch<string>(
    `/kubernetes/clusters/${clusterId}/kubeconfig`,
    { responseType: 'text' },
  )
}

export async function deleteDOKSCluster(clusterId: string): Promise<void> {
  await doFetch<void>(
    `/kubernetes/clusters/${clusterId}?destroy_associated_resources=true`,
    { method: 'DELETE' },
  )
}

// ---------------------------------------------------------------------------
// Node pools
// ---------------------------------------------------------------------------

export async function addNodePool(
  clusterId: string,
  opts: AddNodePoolOpts,
): Promise<DOKSNodePool> {
  const count = opts.count ?? DEFAULT_NODE_COUNT
  const body = {
    size: opts.size ?? DEFAULT_NODE_SIZE,
    name: opts.name,
    count,
    auto_scale: true,
    min_nodes: 1,
    max_nodes: Math.max(count * 3, 6),
    tags: ['hanzo-managed'],
  }

  const data = await doFetch<{ node_pool: DOKSNodePool }>(
    `/kubernetes/clusters/${clusterId}/node_pools`,
    { method: 'POST', body },
  )
  return data.node_pool
}

export async function updateNodePool(
  clusterId: string,
  poolId: string,
  opts: UpdateNodePoolOpts,
): Promise<DOKSNodePool> {
  const body: Record<string, unknown> = {
    auto_scale: true,
    min_nodes: 1,
    max_nodes: Math.max((opts.count ?? 3) * 3, 6),
  }
  if (opts.count !== undefined) body.count = opts.count
  if (opts.size !== undefined) body.size = opts.size

  const data = await doFetch<{ node_pool: DOKSNodePool }>(
    `/kubernetes/clusters/${clusterId}/node_pools/${poolId}`,
    { method: 'PUT', body },
  )
  return data.node_pool
}

export async function deleteNodePool(
  clusterId: string,
  poolId: string,
): Promise<void> {
  await doFetch<void>(
    `/kubernetes/clusters/${clusterId}/node_pools/${poolId}`,
    { method: 'DELETE' },
  )
}

// ---------------------------------------------------------------------------
// Cluster operations
// ---------------------------------------------------------------------------

export async function upgradeToHA(clusterId: string): Promise<DOKSCluster> {
  const data = await doFetch<{ kubernetes_cluster: DOKSCluster }>(
    `/kubernetes/clusters/${clusterId}`,
    { method: 'PUT', body: { ha: true } },
  )
  return data.kubernetes_cluster
}

export async function listDOKSClusters(): Promise<DOKSCluster[]> {
  const data = await doFetch<{ kubernetes_clusters: DOKSCluster[] }>(
    '/kubernetes/clusters',
  )
  return data.kubernetes_clusters ?? []
}

// ---------------------------------------------------------------------------
// Discovery / pricing
// ---------------------------------------------------------------------------

export async function listNodeSizes(): Promise<DOKSOptions> {
  const data = await doFetch<{ options: DOKSOptions }>(
    '/kubernetes/options',
  )
  return data.options
}

export async function listRegions(): Promise<DOKSRegion[]> {
  const data = await doFetch<{ regions: DOKSRegion[] }>('/regions')
  return data.regions.filter(r => r.available && r.features.includes('kubernetes'))
}

export async function getDropletPricing(sizeSlug: string): Promise<DropletPricing | null> {
  const data = await doFetch<{ sizes: any[] }>('/sizes')
  const size = data.sizes.find(s => s.slug === sizeSlug)
  if (!size) return null
  return {
    slug: size.slug,
    priceMonthly: size.price_monthly,
    priceHourly: size.price_hourly,
    vcpus: size.vcpus,
    memory: size.memory,
    disk: size.disk,
    description: size.description,
  }
}
