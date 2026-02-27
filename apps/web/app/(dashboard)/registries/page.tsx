'use client'

import { useState } from 'react'
import {
  ExternalLink,
  Package,
  Plus,
  Shield,
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
} from '@hanzo/ui/primitives'
import { StatusBadge } from '@/components/status-badge'
import { EmptyState } from '@/components/empty-state'

const mockRegistries = [
  {
    id: 'ghcr',
    name: 'GitHub Container Registry',
    url: 'ghcr.io/hanzoai',
    type: 'GHCR',
    status: 'running',
    images: 14,
  },
  {
    id: 'dockerhub',
    name: 'Docker Hub',
    url: 'docker.io/hanzoai',
    type: 'Docker Hub',
    status: 'running',
    images: 6,
  },
]

export default function RegistriesPage() {
  const [open, setOpen] = useState(false)
  const registries = mockRegistries

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Registries</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage container registries for pulling and pushing images.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Registry
        </Button>
      </div>

      {registries.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No registries configured"
          description="Add a container registry to pull images for deployments."
          action={
            <Button onClick={() => setOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Registry
            </Button>
          }
        />
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Name</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Images</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registries.map((reg) => (
                <TableRow key={reg.id}>
                  <TableCell className="font-medium">{reg.name}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {reg.url}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                      {reg.type}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={reg.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{reg.images}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Registry</DialogTitle>
            <DialogDescription>
              Connect a container registry for image storage and deployments.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input placeholder="My Registry" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <Select defaultValue="ghcr">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ghcr">GitHub Container Registry</SelectItem>
                  <SelectItem value="dockerhub">Docker Hub</SelectItem>
                  <SelectItem value="ecr">AWS ECR</SelectItem>
                  <SelectItem value="gcr">Google Container Registry</SelectItem>
                  <SelectItem value="acr">Azure Container Registry</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">URL</label>
              <Input placeholder="ghcr.io/my-org" className="font-mono" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Username</label>
              <Input placeholder="username or token name" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Password / Token</label>
              <Input type="password" placeholder="ghp_..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setOpen(false)}>Add Registry</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
