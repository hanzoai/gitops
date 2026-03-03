'use client'

import { useState } from 'react'
import {
  ChevronDown,
  ExternalLink,
  GitBranch,
  Loader2,
  Search,
  Circle,
  Container,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Input,
} from '@hanzo/ui/primitives'
import { EmptyState } from '@/components/empty-state'
import { trpc } from '@/lib/trpc'

type Org = {
  id: string
  name: string
  pictureUrl: string | null
  role: string
}

type Repo = {
  id: string
  installationId: string
  orgId: string
  externalId: string
  fullName: string
  name: string
  owner: string
  url: string
  cloneUrl: string
  defaultBranch: string
  isPrivate: boolean
  language: string | null
  description: string | null
  topics: string[] | null
  ciStatus: string | null
  ciUrl: string | null
  lastPushAt: string | null
  lastPushBranch: string | null
  lastCommitSha: string | null
  lastCommitMsg: string | null
  containerId: string | null
  projectId: string | null
  archivedAt: string | null
  syncedAt: string | null
  createdAt: string
  updatedAt: string
}

function timeAgo(date: Date | string | null): string {
  if (!date) return ''
  const now = Date.now()
  const then = new Date(date).getTime()
  const seconds = Math.floor((now - then) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

const ciConfig: Record<string, { color: string; label: string }> = {
  success: { color: 'bg-emerald-500', label: 'Passing' },
  failure: { color: 'bg-red-500', label: 'Failing' },
  pending: { color: 'bg-amber-500', label: 'Pending' },
}

function CIBadge({ status }: { status: string | null }) {
  if (!status) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
        <Circle className="h-2 w-2 fill-zinc-600 text-zinc-600" />
        No CI
      </span>
    )
  }
  const config = ciConfig[status] ?? { color: 'bg-zinc-500', label: status }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <span className={cn('h-2 w-2 rounded-full', config.color)} />
      {config.label}
    </span>
  )
}

function RepoCard({ repo }: { repo: Repo }) {
  return (
    <a
      href={repo.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex flex-col rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-5 transition-all duration-200 hover:border-zinc-700 hover:bg-zinc-900"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-zinc-100 group-hover:text-white transition-colors">
              {repo.fullName}
            </h3>
            {repo.isPrivate && (
              <span className="shrink-0 rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
                Private
              </span>
            )}
          </div>
          {repo.description && (
            <p className="mt-1 line-clamp-2 text-xs text-zinc-500">
              {repo.description}
            </p>
          )}
        </div>
        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-zinc-700 transition-colors group-hover:text-zinc-400" />
      </div>

      {/* Status row */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <CIBadge status={repo.ciStatus} />
        {repo.language && (
          <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-600" />
            {repo.language}
          </span>
        )}
        {repo.containerId ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
            <Container className="h-3 w-3" />
            Linked
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-zinc-600">
            <Container className="h-3 w-3" />
            Not deployed
          </span>
        )}
      </div>

      {/* Push info */}
      {repo.lastPushAt && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-zinc-500">
          <Clock className="h-3 w-3" />
          pushed {timeAgo(repo.lastPushAt)}
          {repo.lastPushBranch && (
            <>
              {' '}to{' '}
              <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
                {repo.lastPushBranch}
              </span>
            </>
          )}
        </div>
      )}

      {/* Topics */}
      {repo.topics && repo.topics.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {repo.topics.slice(0, 5).map((topic) => (
            <span
              key={topic}
              className="rounded-full bg-zinc-800/80 px-2 py-0.5 text-[10px] font-medium text-zinc-400"
            >
              {topic}
            </span>
          ))}
          {repo.topics.length > 5 && (
            <span className="rounded-full bg-zinc-800/80 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
              +{repo.topics.length - 5}
            </span>
          )}
        </div>
      )}
    </a>
  )
}

export default function ReposPage() {
  const [search, setSearch] = useState('')
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null)
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false)

  const orgsQuery = trpc.organization.list.useQuery()
  const orgs = (orgsQuery.data ?? []) as Org[]

  // Auto-select first org when loaded
  const activeOrgId = selectedOrgId ?? orgs[0]?.id ?? null
  const activeOrg = orgs.find((o) => o.id === activeOrgId)

  const reposQuery = trpc.repository.list.useQuery(
    { orgId: activeOrgId!, search: search || undefined },
    { enabled: !!activeOrgId },
  )
  const repos = (reposQuery.data ?? []) as Repo[]

  const isLoading = orgsQuery.isLoading || (!!activeOrgId && reposQuery.isLoading)
  const isEmpty = !isLoading && repos.length === 0
  const hasError = orgsQuery.error || reposQuery.error

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Repositories</h1>
          <p className="mt-1 text-sm text-zinc-400">
            GitHub repositories synced to your organizations.
          </p>
        </div>
      </div>

      {/* Org selector + search */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Org selector */}
        {orgs.length > 1 && (
          <div className="relative">
            <button
              onClick={() => setOrgDropdownOpen(!orgDropdownOpen)}
              className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-200 transition-colors hover:border-zinc-700 hover:bg-zinc-900"
            >
              <Avatar className="h-5 w-5 rounded">
                <AvatarImage src={activeOrg?.pictureUrl ?? undefined} />
                <AvatarFallback className="rounded bg-zinc-800 text-[10px] font-medium text-zinc-400">
                  {activeOrg?.name.slice(0, 2).toUpperCase() ?? '??'}
                </AvatarFallback>
              </Avatar>
              {activeOrg?.name ?? 'Select org'}
              <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
            </button>
            {orgDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setOrgDropdownOpen(false)}
                />
                <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-lg border border-zinc-800 bg-zinc-900 py-1 shadow-xl">
                  {orgs.map((org) => (
                    <button
                      key={org.id}
                      onClick={() => {
                        setSelectedOrgId(org.id)
                        setOrgDropdownOpen(false)
                      }}
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-zinc-800',
                        org.id === activeOrgId ? 'text-white' : 'text-zinc-400',
                      )}
                    >
                      <Avatar className="h-5 w-5 rounded">
                        <AvatarImage src={org.pictureUrl ?? undefined} />
                        <AvatarFallback className="rounded bg-zinc-800 text-[10px] font-medium text-zinc-400">
                          {org.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {org.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Search */}
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            placeholder="Search repositories..."
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            className="bg-zinc-900/50 border-zinc-800 pl-9 text-sm placeholder:text-zinc-600"
          />
        </div>
      </div>

      {/* Content */}
      {hasError && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          Failed to load repositories: {(reposQuery.error ?? orgsQuery.error)?.message}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-600" />
        </div>
      ) : !activeOrgId ? (
        <EmptyState
          icon={GitBranch}
          title="No organizations"
          description="Create an organization first to see your connected repositories."
        />
      ) : isEmpty ? (
        <EmptyState
          icon={GitBranch}
          title="No repositories found"
          description={
            search
              ? `No repositories matching "${search}". Try a different search.`
              : 'Connect a GitHub App installation to sync repositories for this organization.'
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {repos.map((repo) => (
            <RepoCard key={repo.id} repo={repo} />
          ))}
        </div>
      )}
    </div>
  )
}
