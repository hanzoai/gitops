'use client'

import { useState } from 'react'
import {
  ArrowRight,
  ExternalLink,
  Globe,
  Loader2,
  Lock,
  Network,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
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

export default function IngressPage() {
  const [search, setSearch] = useState('')

  return (
    <div>
      {/* Page header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Ingress</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Manage ingress rules, TLS certificates, and custom domains across all clusters.
          </p>
        </div>
        <Button size="sm" className="gap-2 bg-white text-zinc-900 hover:bg-zinc-200">
          <Plus className="h-3.5 w-3.5" />
          Add Ingress
        </Button>
      </div>

      {/* Stats */}
      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-800">
              <Network className="h-4 w-4 text-zinc-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">--</p>
              <p className="text-xs text-zinc-500">Ingress Rules</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-800">
              <Globe className="h-4 w-4 text-zinc-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">--</p>
              <p className="text-xs text-zinc-500">Custom Domains</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-800">
              <Lock className="h-4 w-4 text-zinc-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">--</p>
              <p className="text-xs text-zinc-500">TLS Certificates</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-800">
              <ShieldCheck className="h-4 w-4 text-zinc-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">--</p>
              <p className="text-xs text-zinc-500">Zero Trust Policies</p>
            </div>
          </div>
        </div>
      </div>

      {/* Coming soon notice */}
      <EmptyState
        icon={Network}
        title="Ingress management coming soon"
        description="Configure ingress rules, custom domains, TLS certificates, and Zero Trust access policies for all your services across every cluster."
      />
    </div>
  )
}
