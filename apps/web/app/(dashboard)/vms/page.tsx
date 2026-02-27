'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Cloud,
  Globe,
  Loader2,
  Monitor,
  MoreHorizontal,
  Plus,
  Power,
  PowerOff,
  RotateCcw,
  Search,
  Terminal,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
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

const providerIcons: Record<string, string> = {
  aws: 'AWS',
  digitalocean: 'DO',
  hetzner: 'HZ',
}

export default function VMsPage() {
  const [search, setSearch] = useState('')

  const vmsQuery = trpc.vm.list.useQuery()
  const vms = (vmsQuery.data as any[]) ?? []
  const isLoading = vmsQuery.isLoading
  const isEmpty = vms.length === 0

  const stopMutation = trpc.vm.stop.useMutation({
    onSuccess: () => vmsQuery.refetch(),
  })
  const startMutation = trpc.vm.start.useMutation({
    onSuccess: () => vmsQuery.refetch(),
  })
  const rebootMutation = trpc.vm.reboot.useMutation({
    onSuccess: () => vmsQuery.refetch(),
  })

  const filtered = vms.filter(
    (vm: any) =>
      vm.name?.toLowerCase().includes(search.toLowerCase()) ||
      vm.provider?.toLowerCase().includes(search.toLowerCase()) ||
      vm.region?.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div>
      {/* Page header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Virtual Machines</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Launch and manage VMs on AWS, DigitalOcean, and Hetzner.
          </p>
        </div>
        <Link href="/vms/launch">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Launch VM
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : isEmpty ? (
        <EmptyState
          icon={Monitor}
          title="No virtual machines"
          description="Launch your first VM on AWS, DigitalOcean, or Hetzner."
          action={
            <Link href="/vms/launch">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Launch your first VM
              </Button>
            </Link>
          }
        />
      ) : (
        <>
          {/* Search */}
          <div className="mb-4 flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search VMs..."
                value={search}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Table */}
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Name</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      No VMs match your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((vm: any) => (
                    <TableRow key={vm.id} className="group">
                      <TableCell>
                        <Link
                          href={`/vms/${vm.id}`}
                          className="font-medium text-foreground transition-colors group-hover:text-white"
                        >
                          {vm.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2 py-0.5 text-xs font-medium">
                          <Cloud className="h-3 w-3" />
                          {providerIcons[vm.provider] ?? vm.provider}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {vm.size ?? '--'}
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5 text-muted-foreground text-sm">
                          <Globe className="h-3.5 w-3.5" />
                          {vm.region ?? '--'}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {vm.ipAddress ?? '--'}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={vm.status} />
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Link href={`/vms/${vm.id}`} className="flex w-full items-center">
                                <Terminal className="mr-2 h-4 w-4" />
                                Terminal
                              </Link>
                            </DropdownMenuItem>
                            {vm.status === 'running' ? (
                              <DropdownMenuItem>
                                <button type="button" className="flex w-full items-center" onClick={() => stopMutation.mutate({ id: vm.id })}>
                                  <PowerOff className="mr-2 h-4 w-4" />
                                  Stop
                                </button>
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem>
                                <button type="button" className="flex w-full items-center" onClick={() => startMutation.mutate({ id: vm.id })}>
                                  <Power className="mr-2 h-4 w-4" />
                                  Start
                                </button>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem>
                              <button type="button" className="flex w-full items-center" onClick={() => rebootMutation.mutate({ id: vm.id })}>
                                <RotateCcw className="mr-2 h-4 w-4" />
                                Reboot
                              </button>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-400 focus:text-red-400">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Destroy
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {vmsQuery.error && (
        <div className="mt-4 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load VMs: {vmsQuery.error.message}
        </div>
      )}
    </div>
  )
}
