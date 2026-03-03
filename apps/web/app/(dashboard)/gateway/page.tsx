'use client'

import { useState } from 'react'
import {
  Globe,
  Loader2,
  Plus,
  Search,
  Shield,
  Zap,
  ArrowRight,
  ExternalLink,
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
} from '@hanzo/ui/primitives'
import { StatusBadge } from '@/components/status-badge'
import { EmptyState } from '@/components/empty-state'
import { trpc } from '@/lib/trpc'

type GatewayRoute = {
  id: string
  name: string
  host: string
  path: string
  upstream: string
  protocol: 'http' | 'https' | 'grpc'
  rateLimit: string | null
  auth: 'none' | 'jwt' | 'api-key' | 'oauth'
  status: string
}

// Gateway routes are driven by PaaS domain + container configuration
// This page provides a read-only view + management interface

export default function GatewayPage() {
  const [search, setSearch] = useState('')

  // Use domain data from containers as gateway routes
  const orgsQuery = trpc.organization.list.useQuery()
  const orgs = orgsQuery.data ?? []
  const isLoading = orgsQuery.isLoading

  return (
    <div>
      {/* Page header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Gateway</h1>
          <p className="mt-1 text-sm text-zinc-400">
            API gateway routing, rate limiting, and authentication for all services.
          </p>
        </div>
        <Button size="sm" className="gap-2 bg-white text-zinc-900 hover:bg-zinc-200">
          <Plus className="h-3.5 w-3.5" />
          Add Route
        </Button>
      </div>

      {/* Stats */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-800">
              <Globe className="h-4 w-4 text-zinc-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">--</p>
              <p className="text-xs text-zinc-500">Active Routes</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-800">
              <Shield className="h-4 w-4 text-zinc-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">--</p>
              <p className="text-xs text-zinc-500">Auth Policies</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-800">
              <Zap className="h-4 w-4 text-zinc-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">--</p>
              <p className="text-xs text-zinc-500">Rate Limits</p>
            </div>
          </div>
        </div>
      </div>

      {/* Coming soon notice */}
      <EmptyState
        icon={Globe}
        title="Gateway management coming soon"
        description="Configure API gateway routes, rate limiting, JWT/OAuth authentication, and traffic policies for all your services from a single pane."
      />
    </div>
  )
}
