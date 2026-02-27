'use client'

import { use } from 'react'
import Link from 'next/link'
import {
  Activity,
  AlertTriangle,
  Box,
  Cloud,
  Cpu,
  Globe,
  HardDrive,
  MemoryStick,
  Network,
  Plug,
  Server,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@hanzo/ui/primitives'
import { StatCard } from '@/components/stat-card'
import { StatusBadge } from '@/components/status-badge'
import { ClusterTypeIcon } from '@/components/cluster-type-icon'

// Mock data
function getCluster(id: string) {
  return {
    id,
    name: id,
    type: 'kubernetes' as const,
    provider: 'DigitalOcean',
    region: 'SFO3',
    status: 'running',
    version: '1.31.1',
    org: 'Hanzo',
    orgId: 'hanzo',
    createdAt: '2024-06-15',
    nodeCount: 9,
    podCount: 47,
    cpuUsage: 62,
    memoryUsage: 71,
  }
}

const mockNodes = [
  {
    id: 'node-1',
    name: 'pool-s4vcpu-8gb-01',
    status: 'running',
    role: 'worker',
    size: 's-4vcpu-8gb',
    cpu: 68,
    memory: 74,
    pods: 12,
    ip: '10.132.0.2',
  },
  {
    id: 'node-2',
    name: 'pool-s4vcpu-8gb-02',
    status: 'running',
    role: 'worker',
    size: 's-4vcpu-8gb',
    cpu: 55,
    memory: 62,
    pods: 10,
    ip: '10.132.0.3',
  },
  {
    id: 'node-3',
    name: 'pool-s4vcpu-8gb-03',
    status: 'running',
    role: 'worker',
    size: 's-4vcpu-8gb',
    cpu: 82,
    memory: 88,
    pods: 15,
    ip: '10.132.0.4',
  },
  {
    id: 'node-4',
    name: 'pool-s4vcpu-8gb-04',
    status: 'running',
    role: 'worker',
    size: 's-4vcpu-8gb',
    cpu: 41,
    memory: 58,
    pods: 10,
    ip: '10.132.0.5',
  },
]

const mockContainers = [
  {
    id: 'platform-api',
    name: 'platform-api',
    image: 'ghcr.io/hanzoai/paas-api:v2.4.1',
    status: 'running',
    replicas: '3/3',
    namespace: 'hanzo',
  },
  {
    id: 'studio-ui',
    name: 'studio-ui',
    image: 'ghcr.io/hanzoai/paas-ui:v1.8.0',
    status: 'running',
    replicas: '2/2',
    namespace: 'hanzo',
  },
  {
    id: 'kms-operator',
    name: 'kms-operator',
    image: 'ghcr.io/hanzoai/kms-operator:v1.2.0',
    status: 'running',
    replicas: '1/1',
    namespace: 'hanzo',
  },
  {
    id: 'nginx-ingress',
    name: 'ingress-nginx',
    image: 'registry.k8s.io/ingress-nginx/controller:v1.12.0',
    status: 'running',
    replicas: '2/2',
    namespace: 'ingress-nginx',
  },
  {
    id: 'cert-manager',
    name: 'cert-manager',
    image: 'quay.io/jetstack/cert-manager-controller:v1.16.0',
    status: 'running',
    replicas: '1/1',
    namespace: 'cert-manager',
  },
]

function UsageBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn('h-2 w-full rounded-full bg-secondary', className)}>
      <div
        className={cn(
          'h-full rounded-full transition-all',
          value > 85
            ? 'bg-red-500'
            : value > 65
              ? 'bg-amber-500'
              : 'bg-emerald-500',
        )}
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  )
}

export default function ClusterDetailPage({
  params,
}: {
  params: Promise<{ clusterId: string }>
}) {
  const { clusterId } = use(params)
  const cluster = getCluster(clusterId)

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary">
            <Cloud className="h-6 w-6 text-blue-400" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{cluster.name}</h1>
              <StatusBadge status={cluster.status} />
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              <ClusterTypeIcon type={cluster.type} showLabel /> &middot; {cluster.provider} &middot;{' '}
              {cluster.region} &middot; v{cluster.version}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Plug className="h-4 w-4" />
            Test Connection
          </Button>
          <Button variant="outline" className="gap-2 text-red-400 hover:text-red-300 border-red-900/50 hover:border-red-800/50 hover:bg-red-950/30">
            <Trash2 className="h-4 w-4" />
            Remove
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Nodes" value={cluster.nodeCount} icon={Server} />
        <StatCard label="Pods" value={cluster.podCount} icon={Box} />
        <StatCard label="CPU Usage" value={`${cluster.cpuUsage}%`} icon={Cpu} />
        <StatCard label="Memory Usage" value={`${cluster.memoryUsage}%`} icon={MemoryStick} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="nodes">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="nodes">Nodes</TabsTrigger>
          <TabsTrigger value="containers">Containers</TabsTrigger>
          <TabsTrigger value="networking">Networking</TabsTrigger>
        </TabsList>

        {/* Nodes tab */}
        <TabsContent value="nodes" className="mt-6">
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>CPU</TableHead>
                  <TableHead>Memory</TableHead>
                  <TableHead className="text-right">Pods</TableHead>
                  <TableHead>IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockNodes.map((node) => (
                  <TableRow key={node.id}>
                    <TableCell className="font-medium">{node.name}</TableCell>
                    <TableCell>
                      <StatusBadge status={node.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      {node.size}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <UsageBar value={node.cpu} className="w-20" />
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {node.cpu}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <UsageBar value={node.memory} className="w-20" />
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {node.memory}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{node.pods}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {node.ip}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Containers tab */}
        <TabsContent value="containers" className="mt-6">
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Name</TableHead>
                  <TableHead>Image</TableHead>
                  <TableHead>Namespace</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Replicas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockContainers.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="max-w-xs truncate font-mono text-xs text-muted-foreground">
                      {c.image}
                    </TableCell>
                    <TableCell>
                      <span className="rounded bg-secondary px-2 py-0.5 text-xs font-medium">
                        {c.namespace}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={c.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-mono text-sm">
                      {c.replicas}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Networking tab */}
        <TabsContent value="networking" className="mt-6">
          <div className="rounded-lg border border-dashed border-border p-12 text-center">
            <Network className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Network topology visualization coming soon.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
