'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import {
  Box,
  Clock,
  Container,
  Copy,
  ExternalLink,
  GitBranch,
  Globe,
  Play,
  RefreshCw,
  Rocket,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Button,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@hanzo/ui/primitives'
import { StatusBadge } from '@/components/status-badge'
import { Terminal } from '@/components/terminal'

// Mock data
function getProject(id: string) {
  return {
    id,
    name: id === 'platform' ? 'Platform API' : id.charAt(0).toUpperCase() + id.slice(1),
    description: 'Core API backend for the Hanzo Platform',
    repo: 'github.com/hanzoai/paas',
    branch: 'main',
  }
}

type Env = {
  id: string
  name: string
  label: string
  containers: {
    id: string
    name: string
    image: string
    tag: string
    status: string
    replicas: string
    restarts: number
    lastDeploy: string
    port: number
    url?: string
  }[]
}

const environments: Env[] = [
  {
    id: 'production',
    name: 'production',
    label: 'Production',
    containers: [
      {
        id: 'api-prod',
        name: 'platform-api',
        image: 'ghcr.io/hanzoai/paas-api',
        tag: 'v2.4.1',
        status: 'running',
        replicas: '3/3',
        restarts: 0,
        lastDeploy: '3 min ago',
        port: 3000,
        url: 'https://api.hanzo.ai',
      },
      {
        id: 'ui-prod',
        name: 'studio-ui',
        image: 'ghcr.io/hanzoai/paas-ui',
        tag: 'v1.8.0',
        status: 'running',
        replicas: '2/2',
        restarts: 0,
        lastDeploy: '1 hour ago',
        port: 8080,
        url: 'https://platform.hanzo.ai',
      },
      {
        id: 'worker-prod',
        name: 'sync-worker',
        image: 'ghcr.io/hanzoai/paas-sync',
        tag: 'v1.3.0',
        status: 'running',
        replicas: '1/1',
        restarts: 2,
        lastDeploy: '2 days ago',
        port: 0,
      },
    ],
  },
  {
    id: 'staging',
    name: 'staging',
    label: 'Staging',
    containers: [
      {
        id: 'api-staging',
        name: 'platform-api',
        image: 'ghcr.io/hanzoai/paas-api',
        tag: 'v2.5.0-rc.1',
        status: 'running',
        replicas: '1/1',
        restarts: 0,
        lastDeploy: '30 min ago',
        port: 3000,
        url: 'https://staging-api.hanzo.ai',
      },
      {
        id: 'ui-staging',
        name: 'studio-ui',
        image: 'ghcr.io/hanzoai/paas-ui',
        tag: 'v1.9.0-rc.2',
        status: 'provisioning',
        replicas: '0/1',
        restarts: 0,
        lastDeploy: '5 min ago',
        port: 8080,
      },
    ],
  },
  {
    id: 'development',
    name: 'development',
    label: 'Development',
    containers: [
      {
        id: 'api-dev',
        name: 'platform-api',
        image: 'ghcr.io/hanzoai/paas-api',
        tag: 'latest',
        status: 'running',
        replicas: '1/1',
        restarts: 5,
        lastDeploy: '10 min ago',
        port: 3000,
      },
    ],
  },
]

const mockLogs = [
  '\x1b[90m2026-02-25T10:30:01Z\x1b[0m \x1b[32mINFO\x1b[0m  Server starting on :3000',
  '\x1b[90m2026-02-25T10:30:01Z\x1b[0m \x1b[32mINFO\x1b[0m  Connected to MongoDB at mongodb.hanzo.svc.cluster.local:27017',
  '\x1b[90m2026-02-25T10:30:02Z\x1b[0m \x1b[32mINFO\x1b[0m  KMS operator synced 72 secrets',
  '\x1b[90m2026-02-25T10:30:02Z\x1b[0m \x1b[32mINFO\x1b[0m  Health check endpoint ready at /healthz',
  '\x1b[90m2026-02-25T10:30:15Z\x1b[0m \x1b[32mINFO\x1b[0m  GET /v1/cluster/doks/fleet 200 12ms',
  '\x1b[90m2026-02-25T10:30:22Z\x1b[0m \x1b[33mWARN\x1b[0m  Rate limit approaching for DO API (80/250)',
  '\x1b[90m2026-02-25T10:30:45Z\x1b[0m \x1b[32mINFO\x1b[0m  GET /v1/cluster/doks/hanzo/status 200 450ms',
  '\x1b[90m2026-02-25T10:31:01Z\x1b[0m \x1b[32mINFO\x1b[0m  POST /v1/cluster/doks/provision 201 2340ms',
  '\x1b[90m2026-02-25T10:31:05Z\x1b[0m \x1b[32mINFO\x1b[0m  Webhook dispatched: cluster.provisioning',
  '\x1b[90m2026-02-25T10:31:30Z\x1b[0m \x1b[31mERROR\x1b[0m Connection timeout to monitoring sidecar, retrying...',
  '\x1b[90m2026-02-25T10:31:32Z\x1b[0m \x1b[32mINFO\x1b[0m  Reconnected to monitoring sidecar',
]

function ContainerCard({
  container,
  orgId,
  projectId,
  envId,
}: {
  container: Env['containers'][0]
  orgId: string
  projectId: string
  envId: string
}) {
  return (
    <div className="rounded-lg border border-border bg-card transition-all hover:border-accent-foreground/20">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary">
            <Container className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Link
                href={`/orgs/${orgId}/projects/${projectId}/envs/${envId}/${container.id}`}
                className="text-sm font-medium transition-colors hover:text-white"
              >
                {container.name}
              </Link>
              <StatusBadge status={container.status} />
            </div>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">
              {container.image}:{container.tag}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {container.url && (
            <a
              href={container.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
          <Button size="sm" variant="outline" className="gap-1.5 h-8">
            <Rocket className="h-3.5 w-3.5" />
            Deploy
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-6 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Box className="h-3 w-3" />
          Replicas: <span className="font-mono font-medium text-foreground">{container.replicas}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <RefreshCw className="h-3 w-3" />
          Restarts: <span className={cn('font-mono font-medium', container.restarts > 3 ? 'text-amber-400' : 'text-foreground')}>{container.restarts}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="h-3 w-3" />
          {container.lastDeploy}
        </span>
        {container.port > 0 && (
          <span className="flex items-center gap-1.5">
            <Globe className="h-3 w-3" />
            :{container.port}
          </span>
        )}
      </div>
    </div>
  )
}

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ orgId: string; projectId: string }>
}) {
  const { orgId, projectId } = use(params)
  const project = getProject(projectId)
  const [showLogs, setShowLogs] = useState(false)

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
          </div>
          <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <GitBranch className="h-3.5 w-3.5" />
              {project.branch}
            </span>
            <span>&middot;</span>
            <span>{project.repo}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setShowLogs(!showLogs)}
          >
            <Play className="h-4 w-4" />
            {showLogs ? 'Hide Logs' : 'View Logs'}
          </Button>
          <Button variant="outline" className="gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </Button>
        </div>
      </div>

      {/* Environment tabs */}
      <Tabs defaultValue="production">
        <TabsList className="bg-secondary/50">
          {environments.map((env) => (
            <TabsTrigger key={env.id} value={env.id} className="gap-2">
              {env.label}
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] tabular-nums">
                {env.containers.length}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {environments.map((env) => (
          <TabsContent key={env.id} value={env.id} className="mt-6">
            <div className="space-y-3">
              {env.containers.map((container) => (
                <ContainerCard
                  key={container.id}
                  container={container}
                  orgId={orgId}
                  projectId={projectId}
                  envId={env.id}
                />
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Log viewer */}
      {showLogs && (
        <div className="mt-6">
          <Terminal lines={mockLogs} title="platform-api (production)" maxHeight="350px" />
        </div>
      )}
    </div>
  )
}
