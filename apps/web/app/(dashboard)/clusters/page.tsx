'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Cloud,
  Container,
  Globe,
  HardDrive,
  Loader2,
  Plus,
  Search,
  Server,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
  Textarea,
} from '@hanzo/ui/primitives'
import { StatusBadge } from '@/components/status-badge'
import { ClusterTypeIcon } from '@/components/cluster-type-icon'
import { EmptyState } from '@/components/empty-state'
import { trpc } from '@/lib/trpc'

function RegisterClusterDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [clusterType, setClusterType] = useState('kubernetes')
  const [testing, setTesting] = useState(false)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Register Cluster</DialogTitle>
          <DialogDescription>
            Connect a Kubernetes cluster, Docker Swarm, or Docker Compose host.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Cluster type selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Cluster Type</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'kubernetes', icon: Cloud, label: 'Kubernetes' },
                { value: 'docker-swarm', icon: Server, label: 'Docker Swarm' },
                { value: 'docker-compose', icon: Container, label: 'Compose' },
              ].map((t) => (
                <button
                  key={t.value}
                  onClick={() => setClusterType(t.value)}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-lg border p-4 text-sm transition-all',
                    clusterType === t.value
                      ? 'border-primary bg-accent text-accent-foreground'
                      : 'border-border text-muted-foreground hover:border-accent-foreground/20 hover:bg-accent/30',
                  )}
                >
                  <t.icon className="h-5 w-5" />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Cluster Name</label>
            <Input placeholder="my-cluster" />
          </div>

          {/* Provider */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Provider</label>
            <Select defaultValue="digitalocean">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="digitalocean">DigitalOcean</SelectItem>
                <SelectItem value="aws">AWS (EKS)</SelectItem>
                <SelectItem value="gcp">Google Cloud (GKE)</SelectItem>
                <SelectItem value="azure">Azure (AKS)</SelectItem>
                <SelectItem value="hetzner">Hetzner</SelectItem>
                <SelectItem value="local">Local / Self-hosted</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Connection details */}
          {clusterType === 'kubernetes' ? (
            <div className="space-y-2">
              <label className="text-sm font-medium">Kubeconfig</label>
              <Textarea
                placeholder="Paste your kubeconfig YAML here..."
                rows={6}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                The kubeconfig will be encrypted and stored securely via KMS.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-sm font-medium">Docker Host</label>
              <Input placeholder="ssh://user@host:22 or tcp://host:2376" className="font-mono" />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setTesting(true)
              setTimeout(() => setTesting(false), 2000)
            }}
            disabled={testing}
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </Button>
          <Button onClick={() => onOpenChange(false)}>Register</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function ClustersPage() {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const clustersQuery = trpc.cluster.listAll.useQuery()
  const clusters = clustersQuery.data ?? []
  const isLoading = clustersQuery.isLoading
  const isEmpty = clusters.length === 0

  const filtered = clusters.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.orgName.toLowerCase().includes(search.toLowerCase()) ||
      c.provider.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div>
      {/* Page header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fleet</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            All clusters across all organizations. K8s, Docker Swarm, and Compose -- unified.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Register Cluster
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : isEmpty ? (
        <EmptyState
          icon={Server}
          title="No clusters registered"
          description="Add a Kubernetes cluster, Docker Swarm node, or local Docker socket to get started."
          action={
            <Button onClick={() => setOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Register your first cluster
            </Button>
          }
        />
      ) : (
        <>
          {/* Search */}
          <div className="mb-4 flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search clusters..."
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
                  <TableHead>Type</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Region</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      No clusters match your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((cluster) => (
                    <TableRow key={cluster.id} className="group">
                      <TableCell>
                        <Link
                          href={`/clusters/${cluster.id}`}
                          className="font-medium text-foreground transition-colors group-hover:text-white"
                        >
                          {cluster.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <ClusterTypeIcon type={cluster.type} showLabel />
                      </TableCell>
                      <TableCell className="text-muted-foreground capitalize">
                        {cluster.provider}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={cluster.status} />
                      </TableCell>
                      <TableCell>
                        {cluster.orgId ? (
                          <Link
                            href={`/orgs/${cluster.orgId}`}
                            className="text-muted-foreground transition-colors hover:text-foreground"
                          >
                            {cluster.orgName}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {cluster.cloudRegion ? (
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <Globe className="h-3.5 w-3.5" />
                            {cluster.cloudRegion}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Error state */}
      {clustersQuery.error && (
        <div className="mt-4 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load clusters: {clustersQuery.error.message}
        </div>
      )}

      <RegisterClusterDialog open={open} onOpenChange={setOpen} />
    </div>
  )
}
