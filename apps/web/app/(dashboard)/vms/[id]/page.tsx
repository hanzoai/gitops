'use client'

import { use } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Cloud,
  Globe,
  HardDrive,
  Loader2,
  Monitor,
  Power,
  PowerOff,
  RotateCcw,
  Terminal,
  Trash2,
} from 'lucide-react'
import {
  Button,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@hanzo/ui/primitives'
import { StatusBadge } from '@/components/status-badge'
import { StatCard } from '@/components/stat-card'
import { trpc } from '@/lib/trpc'

export default function VMDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const vmQuery = trpc.vm.get.useQuery({ id })
  const vm = vmQuery.data as any

  const stopMutation = trpc.vm.stop.useMutation({
    onSuccess: () => vmQuery.refetch(),
  })
  const startMutation = trpc.vm.start.useMutation({
    onSuccess: () => vmQuery.refetch(),
  })
  const rebootMutation = trpc.vm.reboot.useMutation({
    onSuccess: () => vmQuery.refetch(),
  })

  if (vmQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (vmQuery.error || !vm) {
    return (
      <div className="space-y-4">
        <Link
          href="/vms"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to VMs
        </Link>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {vmQuery.error?.message ?? 'VM not found'}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Breadcrumb */}
      <Link
        href="/vms"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to VMs
      </Link>

      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary">
            <Monitor className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{vm.name}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Cloud className="h-3.5 w-3.5" />
                {vm.provider}
              </span>
              <span className="flex items-center gap-1">
                <Globe className="h-3.5 w-3.5" />
                {vm.region}
              </span>
              <StatusBadge status={vm.status} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {vm.status === 'running' ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => stopMutation.mutate({ id })}
              disabled={stopMutation.isPending}
            >
              <PowerOff className="mr-2 h-4 w-4" />
              Stop
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => startMutation.mutate({ id })}
              disabled={startMutation.isPending}
            >
              <Power className="mr-2 h-4 w-4" />
              Start
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => rebootMutation.mutate({ id })}
            disabled={rebootMutation.isPending}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reboot
          </Button>
          <Button variant="destructive" size="sm">
            <Trash2 className="mr-2 h-4 w-4" />
            Destroy
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 mb-8 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="IP Address"
          value={vm.ipAddress ?? '--'}
          icon={Globe}
        />
        <StatCard
          label="Size"
          value={vm.size ?? '--'}
          icon={Monitor}
        />
        <StatCard
          label="Storage"
          value={vm.diskSize ? `${vm.diskSize} GB` : '--'}
          icon={HardDrive}
        />
        <StatCard
          label="Status"
          value={vm.status ?? 'unknown'}
          icon={Power}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="terminal">
        <TabsList>
          <TabsTrigger value="terminal">Terminal</TabsTrigger>
          <TabsTrigger value="volumes">Volumes</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="terminal" className="mt-4">
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/50">
              <div className="flex gap-1.5">
                <div className="size-3 rounded-full bg-red-500" />
                <div className="size-3 rounded-full bg-yellow-500" />
                <div className="size-3 rounded-full bg-green-500" />
              </div>
              <span className="text-xs text-muted-foreground ml-2">
                {vm.name} — {vm.ipAddress ?? 'connecting...'}
              </span>
            </div>
            <div className="bg-black p-4 min-h-[400px] flex items-center justify-center text-muted-foreground text-sm">
              {vm.status === 'running' ? (
                <p>Terminal connection will be established via WebSocket.</p>
              ) : (
                <p>VM must be running to connect to terminal.</p>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="volumes" className="mt-4">
          <div className="rounded-xl border p-8 text-center text-muted-foreground">
            <HardDrive className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No volumes attached</p>
            <p className="text-sm mt-1">Create and attach block storage volumes to this VM.</p>
            <Button variant="outline" size="sm" className="mt-4">
              Create Volume
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="details" className="mt-4">
          <div className="rounded-xl border divide-y">
            {[
              { label: 'ID', value: vm.id },
              { label: 'Name', value: vm.name },
              { label: 'Provider', value: vm.provider },
              { label: 'Region', value: vm.region },
              { label: 'Size', value: vm.size },
              { label: 'Image', value: vm.image ?? '--' },
              { label: 'IP Address', value: vm.ipAddress ?? '--' },
              { label: 'Created', value: vm.createdAt ?? '--' },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between px-6 py-3 text-sm">
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-mono">{row.value}</span>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
