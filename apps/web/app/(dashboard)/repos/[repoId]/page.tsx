'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Clock,
  Container,
  ExternalLink,
  GitBranch,
  GitCommit,
  Loader2,
  Lock,
  Globe,
  Link2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@hanzo/ui/primitives'
import { EmptyState } from '@/components/empty-state'
import { trpc } from '@/lib/trpc'

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

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between border-b border-zinc-800/60 py-3 last:border-0">
      <span className="text-sm text-zinc-500">{label}</span>
      <span className="text-sm text-zinc-200">{children}</span>
    </div>
  )
}

export default function RepoDetailPage({
  params,
}: {
  params: Promise<{ repoId: string }>
}) {
  const { repoId } = use(params)

  // Load all orgs, then find the repo across them
  const orgsQuery = trpc.organization.list.useQuery()
  const orgs = orgsQuery.data ?? []
  const firstOrgId = orgs[0]?.id

  // We need orgId to query repos. Load from first org and search for the repo.
  // In production you'd have a trpc.repository.get({ id }) endpoint, but for now
  // we load the list for the first org and find by id.
  const reposQuery = trpc.repository.list.useQuery(
    { orgId: firstOrgId!, limit: 200 },
    { enabled: !!firstOrgId },
  )

  // Try to find the repo across all loaded data
  const allRepos = (reposQuery.data ?? []) as Repo[]
  const repo = allRepos.find((r) => r.id === repoId)

  const isLoading = orgsQuery.isLoading || reposQuery.isLoading
  const hasError = orgsQuery.error || reposQuery.error

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-600" />
      </div>
    )
  }

  if (hasError) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
        Failed to load repository: {(reposQuery.error ?? orgsQuery.error)?.message}
      </div>
    )
  }

  if (!repo) {
    return (
      <div>
        <Link
          href="/repos"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-zinc-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to repositories
        </Link>
        <EmptyState
          icon={GitBranch}
          title="Repository not found"
          description="This repository may have been removed or you may not have access."
        />
      </div>
    )
  }

  const ciStatusConfig = repo.ciStatus
    ? ciConfig[repo.ciStatus] ?? { color: 'bg-zinc-500', label: repo.ciStatus }
    : null

  return (
    <div>
      {/* Back nav */}
      <Link
        href="/repos"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-zinc-200"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to repositories
      </Link>

      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              {repo.fullName}
            </h1>
            {repo.isPrivate ? (
              <span className="inline-flex items-center gap-1 rounded border border-zinc-700 px-2 py-0.5 text-xs font-medium text-zinc-400">
                <Lock className="h-3 w-3" />
                Private
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded border border-zinc-700 px-2 py-0.5 text-xs font-medium text-zinc-400">
                <Globe className="h-3 w-3" />
                Public
              </span>
            )}
          </div>
          {repo.description && (
            <p className="mt-2 text-sm text-zinc-400">{repo.description}</p>
          )}
          {repo.topics && repo.topics.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {repo.topics.map((topic) => (
                <span
                  key={topic}
                  className="rounded-full bg-zinc-800/80 px-2.5 py-0.5 text-xs font-medium text-zinc-400"
                >
                  {topic}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {!repo.containerId && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-zinc-700 text-zinc-300"
            >
              <Link2 className="h-3.5 w-3.5" />
              Link to Container
            </Button>
          )}
          <a href={repo.url} target="_blank" rel="noopener noreferrer">
            <Button size="sm" className="gap-2 bg-white text-zinc-900 hover:bg-zinc-200">
              <ExternalLink className="h-3.5 w-3.5" />
              View on GitHub
            </Button>
          </a>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Details panel */}
        <div className="lg:col-span-3">
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-5">
            <h2 className="mb-4 text-sm font-semibold text-zinc-200">Details</h2>

            <InfoRow label="Default branch">
              <span className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-xs text-zinc-300">
                {repo.defaultBranch}
              </span>
            </InfoRow>

            {repo.language && (
              <InfoRow label="Language">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-zinc-600" />
                  {repo.language}
                </span>
              </InfoRow>
            )}

            <InfoRow label="CI status">
              {ciStatusConfig ? (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                  <span className={cn('h-2 w-2 rounded-full', ciStatusConfig.color)} />
                  {ciStatusConfig.label}
                </span>
              ) : (
                <span className="text-zinc-500">No CI configured</span>
              )}
            </InfoRow>

            <InfoRow label="Deploy status">
              {repo.containerId ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-emerald-400">
                  <Container className="h-3.5 w-3.5" />
                  Linked
                </span>
              ) : (
                <span className="text-zinc-500">Not deployed</span>
              )}
            </InfoRow>

            {repo.syncedAt && (
              <InfoRow label="Last synced">{timeAgo(repo.syncedAt)}</InfoRow>
            )}

            <InfoRow label="Created">{timeAgo(repo.createdAt)}</InfoRow>
          </div>
        </div>

        {/* Right column: recent activity */}
        <div className="lg:col-span-2 space-y-6">
          {/* Last push */}
          {repo.lastPushAt && (
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-5">
              <h2 className="mb-4 text-sm font-semibold text-zinc-200">Last Push</h2>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-zinc-300">
                  <Clock className="h-4 w-4 text-zinc-500" />
                  {timeAgo(repo.lastPushAt)}
                  {repo.lastPushBranch && (
                    <>
                      {' '}to{' '}
                      <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-xs text-zinc-300">
                        {repo.lastPushBranch}
                      </span>
                    </>
                  )}
                </div>
                {repo.lastCommitSha && (
                  <div className="flex items-start gap-2 text-sm">
                    <GitCommit className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
                    <div>
                      <span className="font-mono text-xs text-zinc-400">
                        {repo.lastCommitSha.slice(0, 7)}
                      </span>
                      {repo.lastCommitMsg && (
                        <p className="mt-0.5 text-xs text-zinc-500 line-clamp-2">
                          {repo.lastCommitMsg}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CI Runs placeholder */}
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-5">
            <h2 className="mb-4 text-sm font-semibold text-zinc-200">Recent CI Runs</h2>
            <div className="space-y-2">
              {ciStatusConfig ? (
                <div className="flex items-center justify-between rounded-lg border border-zinc-800/60 bg-zinc-950/50 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className={cn('h-2 w-2 rounded-full', ciStatusConfig.color)} />
                    <span className="text-sm text-zinc-300">Latest run</span>
                  </div>
                  <span className="text-xs text-zinc-500">{ciStatusConfig.label}</span>
                </div>
              ) : (
                <p className="text-xs text-zinc-500">
                  No CI runs recorded. Configure a CI pipeline in your repository.
                </p>
              )}
            </div>
          </div>

          {/* Clone URL */}
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-5">
            <h2 className="mb-3 text-sm font-semibold text-zinc-200">Clone</h2>
            <div className="rounded-lg bg-zinc-950 px-3 py-2">
              <code className="text-xs text-zinc-400 break-all">{repo.cloneUrl}</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
