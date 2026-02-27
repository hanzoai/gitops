'use client'

import { use, useState } from 'react'
import {
  AlertTriangle,
  Box,
  Clock,
  Container,
  Copy,
  Eye,
  EyeOff,
  Minus,
  Play,
  Plus,
  RefreshCw,
  Rocket,
  Settings,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Button,
  Input,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@hanzo/ui/primitives'
import { StatCard } from '@/components/stat-card'
import { StatusBadge } from '@/components/status-badge'
import { Terminal } from '@/components/terminal'

// Mock container detail
const container = {
  id: 'api-prod',
  name: 'platform-api',
  image: 'ghcr.io/hanzoai/paas-api',
  tag: 'v2.4.1',
  status: 'running',
  replicas: 3,
  desiredReplicas: 3,
  restarts: 0,
  podCount: 3,
  port: 3000,
  namespace: 'hanzo',
  cluster: 'hanzo-k8s',
  createdAt: '2024-06-15',
  lastDeploy: '2026-02-25T10:27:00Z',
  cpuRequest: '250m',
  cpuLimit: '1000m',
  memRequest: '256Mi',
  memLimit: '1Gi',
}

const envVars = [
  { key: 'NODE_ENV', value: 'production', secret: false },
  { key: 'PORT', value: '3000', secret: false },
  { key: 'CLUSTER_DB_URI', value: 'mongodb://mongodb.hanzo.svc.cluster.local:27017', secret: false },
  { key: 'CLUSTER_DB_USER', value: 'root', secret: false },
  { key: 'CLUSTER_DB_PWD', value: '***', secret: true },
  { key: 'DO_API_TOKEN', value: '***', secret: true },
  { key: 'OAUTH_URL', value: 'https://hanzo.id', secret: false },
  { key: 'IAM_ENDPOINT', value: 'https://iam.hanzo.ai', secret: false },
]

const buildHistory = [
  {
    id: 'build-7',
    tag: 'v2.4.1',
    status: 'running',
    commit: 'a3f8c21',
    message: 'fix: rate limit handler for DO API',
    author: 'z@hanzo.ai',
    duration: '2m 14s',
    time: '3 min ago',
  },
  {
    id: 'build-6',
    tag: 'v2.4.0',
    status: 'stopped',
    commit: 'e7b2d49',
    message: 'feat: fleet overview endpoint',
    author: 'z@hanzo.ai',
    duration: '2m 08s',
    time: '2 hours ago',
  },
  {
    id: 'build-5',
    tag: 'v2.3.2',
    status: 'stopped',
    commit: 'c1a9f87',
    message: 'fix: node pool scaling race condition',
    author: 'dev@hanzo.ai',
    duration: '1m 55s',
    time: '1 day ago',
  },
  {
    id: 'build-4',
    tag: 'v2.3.1',
    status: 'error',
    commit: '5d2b8e3',
    message: 'chore: bump dependencies',
    author: 'dev@hanzo.ai',
    duration: '0m 45s',
    time: '2 days ago',
  },
  {
    id: 'build-3',
    tag: 'v2.3.0',
    status: 'stopped',
    commit: '891fe4a',
    message: 'feat: kubeconfig download endpoint',
    author: 'z@hanzo.ai',
    duration: '2m 22s',
    time: '4 days ago',
  },
]

const mockLogs = [
  '\x1b[90m2026-02-25T10:30:01.123Z\x1b[0m \x1b[32mINFO\x1b[0m  [pod/platform-api-7d8f9b6c4d-x2k9j] Server starting on :3000',
  '\x1b[90m2026-02-25T10:30:01.456Z\x1b[0m \x1b[32mINFO\x1b[0m  [pod/platform-api-7d8f9b6c4d-x2k9j] Connected to MongoDB',
  '\x1b[90m2026-02-25T10:30:02.001Z\x1b[0m \x1b[32mINFO\x1b[0m  [pod/platform-api-7d8f9b6c4d-m5n7p] Server starting on :3000',
  '\x1b[90m2026-02-25T10:30:02.234Z\x1b[0m \x1b[32mINFO\x1b[0m  [pod/platform-api-7d8f9b6c4d-m5n7p] Connected to MongoDB',
  '\x1b[90m2026-02-25T10:30:03.567Z\x1b[0m \x1b[32mINFO\x1b[0m  [pod/platform-api-7d8f9b6c4d-q8r4t] Server starting on :3000',
  '\x1b[90m2026-02-25T10:30:03.789Z\x1b[0m \x1b[32mINFO\x1b[0m  [pod/platform-api-7d8f9b6c4d-q8r4t] Connected to MongoDB',
  '\x1b[90m2026-02-25T10:30:15.012Z\x1b[0m \x1b[32mINFO\x1b[0m  [pod/platform-api-7d8f9b6c4d-x2k9j] GET /healthz 200 1ms',
  '\x1b[90m2026-02-25T10:30:15.345Z\x1b[0m \x1b[32mINFO\x1b[0m  [pod/platform-api-7d8f9b6c4d-m5n7p] GET /v1/cluster/doks/fleet 200 12ms',
  '\x1b[90m2026-02-25T10:30:22.678Z\x1b[0m \x1b[33mWARN\x1b[0m  [pod/platform-api-7d8f9b6c4d-q8r4t] Rate limit approaching for DO API (80/250)',
  '\x1b[90m2026-02-25T10:30:45.901Z\x1b[0m \x1b[32mINFO\x1b[0m  [pod/platform-api-7d8f9b6c4d-x2k9j] GET /v1/cluster/doks/hanzo/status 200 450ms',
  '\x1b[90m2026-02-25T10:31:01.234Z\x1b[0m \x1b[32mINFO\x1b[0m  [pod/platform-api-7d8f9b6c4d-m5n7p] POST /v1/cluster/doks/provision 201 2340ms',
  '\x1b[90m2026-02-25T10:31:30.567Z\x1b[0m \x1b[31mERROR\x1b[0m [pod/platform-api-7d8f9b6c4d-q8r4t] Connection timeout to monitoring sidecar',
  '\x1b[90m2026-02-25T10:31:32.890Z\x1b[0m \x1b[32mINFO\x1b[0m  [pod/platform-api-7d8f9b6c4d-q8r4t] Reconnected to monitoring sidecar',
]

function EnvVarRow({
  envVar,
}: {
  envVar: { key: string; value: string; secret: boolean }
}) {
  const [visible, setVisible] = useState(false)

  return (
    <TableRow>
      <TableCell className="font-mono text-sm font-medium">{envVar.key}</TableCell>
      <TableCell className="font-mono text-sm text-muted-foreground">
        {envVar.secret && !visible ? (
          <span className="select-none">{'*'.repeat(24)}</span>
        ) : (
          envVar.value
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          {envVar.secret && (
            <button
              onClick={() => setVisible(!visible)}
              className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          )}
          <button className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
      </TableCell>
    </TableRow>
  )
}

function ScaleSlider({
  value,
  onChange,
  min = 0,
  max = 10,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
}) {
  return (
    <div className="flex items-center gap-4">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30"
      >
        <Minus className="h-4 w-4" />
      </button>

      <div className="relative flex-1">
        <div className="h-2 rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${(value / max) * 100}%` }}
          />
        </div>
        {/* Ticks */}
        <div className="mt-1 flex justify-between px-0.5">
          {Array.from({ length: max + 1 }, (_, i) => (
            <span
              key={i}
              className={cn(
                'text-[10px] tabular-nums',
                i === value ? 'font-medium text-foreground' : 'text-muted-foreground/50',
              )}
            >
              {i}
            </span>
          ))}
        </div>
      </div>

      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30"
      >
        <Plus className="h-4 w-4" />
      </button>

      <span className="ml-2 min-w-[4rem] text-center text-lg font-bold tabular-nums">
        {value} {value === 1 ? 'replica' : 'replicas'}
      </span>
    </div>
  )
}

export default function ContainerDetailPage({
  params,
}: {
  params: Promise<{
    orgId: string
    projectId: string
    envId: string
    containerId: string
  }>
}) {
  const { orgId, projectId, envId, containerId } = use(params)
  const [replicas, setReplicas] = useState(container.replicas)
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary">
            <Container className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{container.name}</h1>
              <StatusBadge status={container.status} />
            </div>
            <p className="mt-0.5 font-mono text-sm text-muted-foreground">
              {container.image}:{container.tag}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Rocket className="h-4 w-4" />
            Redeploy
          </Button>
          <Button variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Restart
          </Button>
          <Button
            variant="outline"
            className="gap-2 text-red-400 hover:text-red-300 border-red-900/50 hover:border-red-800/50 hover:bg-red-950/30"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pods" value={container.podCount} icon={Box} />
        <StatCard
          label="Replicas"
          value={`${container.replicas}/${container.desiredReplicas}`}
          icon={Container}
        />
        <StatCard
          label="Restarts"
          value={container.restarts}
          icon={RefreshCw}
        />
        <StatCard
          label="Last Deploy"
          value="3 min ago"
          icon={Clock}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="logs">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="env">Environment</TabsTrigger>
          <TabsTrigger value="builds">Build History</TabsTrigger>
          <TabsTrigger value="scale">Scale</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Logs tab */}
        <TabsContent value="logs" className="mt-6">
          <Terminal
            lines={mockLogs}
            title={`${container.name} (${envId}) - all pods`}
            maxHeight="500px"
          />
        </TabsContent>

        {/* Environment variables tab */}
        <TabsContent value="env" className="mt-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Environment variables are synced from KMS. Secret values are encrypted at rest.
            </p>
            <Button variant="outline" size="sm" className="gap-2">
              <Plus className="h-3.5 w-3.5" />
              Add Variable
            </Button>
          </div>
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[200px]">Key</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {envVars.map((v) => (
                  <EnvVarRow key={v.key} envVar={v} />
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Build history tab */}
        <TabsContent value="builds" className="mt-6">
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Tag</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Commit</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {buildHistory.map((build) => (
                  <TableRow key={build.id}>
                    <TableCell className="font-mono text-sm font-medium">{build.tag}</TableCell>
                    <TableCell>
                      <StatusBadge status={build.status} />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {build.commit}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm">{build.message}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{build.author}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {build.duration}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{build.time}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Scale tab */}
        <TabsContent value="scale" className="mt-6">
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="text-lg font-semibold">Replica Scaling</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Adjust the number of pod replicas for this container. Changes are applied immediately.
            </p>
            <div className="mt-6 max-w-xl">
              <ScaleSlider value={replicas} onChange={setReplicas} />
            </div>
            <div className="mt-6 flex items-center gap-3">
              <Button
                disabled={replicas === container.replicas}
                className="gap-2"
              >
                Apply Scaling
              </Button>
              {replicas !== container.replicas && (
                <p className="text-sm text-muted-foreground">
                  {container.replicas} &rarr; {replicas} replicas
                </p>
              )}
            </div>
          </div>

          {/* Resource limits */}
          <div className="mt-6 rounded-lg border border-border bg-card p-6">
            <h3 className="text-lg font-semibold">Resource Limits</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              CPU and memory requests and limits per pod.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-3">
                <h4 className="text-sm font-medium">CPU</h4>
                <div className="flex gap-3">
                  <div className="flex-1 space-y-1">
                    <label className="text-xs text-muted-foreground">Request</label>
                    <Input defaultValue={container.cpuRequest} className="font-mono" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <label className="text-xs text-muted-foreground">Limit</label>
                    <Input defaultValue={container.cpuLimit} className="font-mono" />
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Memory</h4>
                <div className="flex gap-3">
                  <div className="flex-1 space-y-1">
                    <label className="text-xs text-muted-foreground">Request</label>
                    <Input defaultValue={container.memRequest} className="font-mono" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <label className="text-xs text-muted-foreground">Limit</label>
                    <Input defaultValue={container.memLimit} className="font-mono" />
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <Button variant="outline">Save Limits</Button>
            </div>
          </div>
        </TabsContent>

        {/* Settings tab */}
        <TabsContent value="settings" className="mt-6">
          <div className="space-y-6">
            {/* Container info */}
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-lg font-semibold">Container Information</h3>
              <div className="mt-4 grid gap-3 text-sm">
                {[
                  ['Namespace', container.namespace],
                  ['Cluster', container.cluster],
                  ['Image', `${container.image}:${container.tag}`],
                  ['Port', String(container.port)],
                  ['Created', container.createdAt],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-mono">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Danger zone */}
            <div className="rounded-lg border border-red-900/50 bg-red-950/10 p-6">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-red-400">
                <AlertTriangle className="h-5 w-5" />
                Danger Zone
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                These actions are destructive and cannot be undone.
              </p>
              <div className="mt-4 flex gap-3">
                <Button
                  variant="outline"
                  className="border-red-900/50 text-red-400 hover:border-red-800/50 hover:bg-red-950/30 hover:text-red-300"
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete Container
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Delete confirmation dialog */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Container</DialogTitle>
            <DialogDescription>
              This will permanently remove <span className="font-medium text-foreground">{container.name}</span> from
              the <span className="font-medium text-foreground">{envId}</span> environment.
              All pods will be terminated. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => setConfirmDelete(false)}
            >
              Delete Container
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
