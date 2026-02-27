'use client'

import { use } from 'react'
import Link from 'next/link'
import {
  Activity,
  ArrowRight,
  Box,
  Clock,
  Container,
  FolderKanban,
  GitBranch,
  Layers,
  Plus,
  Rocket,
  Server,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Avatar,
  AvatarFallback,
  Button,
} from '@hanzo/ui/primitives'
import { StatCard } from '@/components/stat-card'
import { StatusBadge } from '@/components/status-badge'

// Mock data
const org = {
  id: 'hanzo',
  name: 'Hanzo',
  description: 'AI infrastructure and platform services',
}

const stats = [
  { label: 'Projects', value: 8, icon: FolderKanban, trend: { value: 12, label: 'this month' } },
  { label: 'Environments', value: 14, icon: Layers },
  { label: 'Containers', value: 32, icon: Container },
  { label: 'Clusters', value: 2, icon: Server },
]

const projects = [
  { id: 'platform', name: 'Platform API', envCount: 3, containerCount: 6, status: 'running' },
  { id: 'studio', name: 'Studio UI', envCount: 2, containerCount: 3, status: 'running' },
  { id: 'kms', name: 'KMS Operator', envCount: 2, containerCount: 2, status: 'running' },
  { id: 'login', name: 'Login Service', envCount: 3, containerCount: 4, status: 'running' },
  { id: 'sync', name: 'Sync Worker', envCount: 1, containerCount: 1, status: 'provisioning' },
]

const recentActivity = [
  {
    id: '1',
    action: 'Deployed',
    target: 'platform-api:v2.4.1',
    environment: 'production',
    user: 'z@hanzo.ai',
    time: '3 minutes ago',
    status: 'running',
  },
  {
    id: '2',
    action: 'Scaled',
    target: 'studio-ui to 3 replicas',
    environment: 'production',
    user: 'z@hanzo.ai',
    time: '1 hour ago',
    status: 'running',
  },
  {
    id: '3',
    action: 'Created',
    target: 'sync-worker',
    environment: 'staging',
    user: 'dev@hanzo.ai',
    time: '2 hours ago',
    status: 'provisioning',
  },
  {
    id: '4',
    action: 'Deployed',
    target: 'kms-operator:v1.2.0',
    environment: 'production',
    user: 'z@hanzo.ai',
    time: '5 hours ago',
    status: 'running',
  },
  {
    id: '5',
    action: 'Restarted',
    target: 'login-service',
    environment: 'staging',
    user: 'dev@hanzo.ai',
    time: '1 day ago',
    status: 'running',
  },
]

export default function OrgDetailPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = use(params)

  return (
    <div>
      {/* Page header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="h-12 w-12 rounded-lg">
            <AvatarFallback className="rounded-lg bg-secondary text-base font-semibold">
              {org.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{org.name}</h1>
            <p className="text-sm text-muted-foreground">{org.description}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Server className="h-4 w-4" />
            Add Cluster
          </Button>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* Two columns: projects + activity */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Projects */}
        <div className="lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Projects</h2>
            <Link
              href={`/orgs/${orgId}/projects`}
              className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="space-y-2">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/orgs/${orgId}/projects/${project.id}`}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-all hover:border-accent-foreground/20 hover:bg-accent/30"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary">
                    <FolderKanban className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{project.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {project.envCount} envs &middot; {project.containerCount} containers
                    </p>
                  </div>
                </div>
                <StatusBadge status={project.status} />
              </Link>
            ))}
          </div>
        </div>

        {/* Recent activity */}
        <div className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent Activity</h2>
          </div>
          <div className="rounded-lg border border-border bg-card">
            {recentActivity.map((event, i) => (
              <div
                key={event.id}
                className={cn(
                  'flex items-start gap-3 px-4 py-3',
                  i < recentActivity.length - 1 && 'border-b border-border',
                )}
              >
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary">
                  {event.action === 'Deployed' ? (
                    <Rocket className="h-3.5 w-3.5 text-emerald-400" />
                  ) : event.action === 'Scaled' ? (
                    <Activity className="h-3.5 w-3.5 text-blue-400" />
                  ) : event.action === 'Created' ? (
                    <Plus className="h-3.5 w-3.5 text-amber-400" />
                  ) : (
                    <GitBranch className="h-3.5 w-3.5 text-purple-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">{event.action}</span>{' '}
                    <span className="text-muted-foreground">{event.target}</span>
                  </p>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{event.environment}</span>
                    <span>&middot;</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {event.time}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
