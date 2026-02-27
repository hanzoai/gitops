'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Building2,
  FolderKanban,
  Plus,
  Server,
  Users,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@hanzo/ui/primitives'
import { Button, Input, Textarea } from '@hanzo/ui/primitives'
import { EmptyState } from '@/components/empty-state'
import { trpc } from '@/lib/trpc'

type Org = {
  id: string
  name: string
  pictureUrl: string | null
  role: string
}

function OrgCard({ org }: { org: Org }) {
  return (
    <Link
      href={`/orgs/${org.id}`}
      className="group rounded-lg border border-border bg-card p-6 transition-all hover:border-accent-foreground/20 hover:bg-accent/30"
    >
      <div className="flex items-start gap-4">
        <Avatar className="h-10 w-10 rounded-lg">
          <AvatarImage src={org.pictureUrl ?? undefined} />
          <AvatarFallback className="rounded-lg bg-secondary text-sm font-medium">
            {org.name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 overflow-hidden">
          <h3 className="text-sm font-semibold group-hover:text-white transition-colors">
            {org.name}
          </h3>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {org.role}
          </p>
        </div>
      </div>
    </Link>
  )
}

export default function OrgsPage() {
  const [open, setOpen] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')

  const utils = trpc.useUtils()
  const orgsQuery = trpc.organization.list.useQuery()
  const createOrg = trpc.organization.create.useMutation({
    onSuccess() {
      utils.organization.list.invalidate()
      setOpen(false)
      setNewOrgName('')
    },
  })

  const orgs = orgsQuery.data ?? []
  const isEmpty = orgs.length === 0
  const isLoading = orgsQuery.isLoading

  return (
    <div>
      {/* Page header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Organizations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your organizations and their clusters.
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Organization
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Organization</DialogTitle>
              <DialogDescription>
                Organizations group projects, clusters, and team members.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input
                  placeholder="My Organization"
                  value={newOrgName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewOrgName(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createOrg.mutate({ name: newOrgName })}
                disabled={createOrg.isPending || newOrgName.length < 2}
              >
                {createOrg.isPending ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : isEmpty ? (
        <EmptyState
          icon={Building2}
          title="No organizations yet"
          description="Create an organization to start deploying projects across your clusters."
          action={
            <Button onClick={() => setOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Create your first organization
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orgs.map((org) => (
            <OrgCard key={org.id} org={org} />
          ))}
        </div>
      )}

      {/* Error state */}
      {orgsQuery.error && (
        <div className="mt-4 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load organizations: {orgsQuery.error.message}
        </div>
      )}
    </div>
  )
}
