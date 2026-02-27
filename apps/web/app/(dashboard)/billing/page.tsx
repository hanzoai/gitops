'use client'

import { useEffect, useState } from 'react'
import {
  CreditCard,
  Loader2,
  Server,
  Zap,
  Star,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@hanzo/ui/primitives'
import { StatCard } from '@/components/stat-card'

const PRICING_API = process.env.NEXT_PUBLIC_PRICING_API_URL || '/api'

interface CloudPlan {
  id: string
  name: string
  description: string
  vcpus: number
  memoryGB: number
  diskGB: number
  cpuType: string
  maxVMs: number
  priceMonthly: number
  priceHourly: number
  freeTier?: boolean
  popular?: boolean
  features: string[]
}

export default function BillingPage() {
  const [plans, setPlans] = useState<CloudPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState({ vms: 0, clusters: 0, plan: 'Free' })

  useEffect(() => {
    fetch(`${PRICING_API}/v1/pricing/cloud/plans`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data) => {
        const list = data?.plans ?? data
        if (Array.isArray(list)) {
          setPlans(list)
        } else {
          throw new Error('Unexpected response format')
        }
      })
      .catch((err) => {
        setError(`Failed to load pricing: ${err.message}`)
      })
      .finally(() => setLoading(false))

    // Fetch actual usage stats
    fetch('/api/trpc/vm.list,cluster.list', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          const vmCount = data?.[0]?.result?.data?.length ?? 0
          const clusterCount = data?.[1]?.result?.data?.length ?? 0
          setStats({
            vms: vmCount,
            clusters: clusterCount,
            plan: vmCount > 0 || clusterCount > 0 ? 'Active' : 'Free',
          })
        }
      })
      .catch(() => {})
  }, [])

  return (
    <div>
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Billing & Plans</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View pricing plans and manage your billing.
        </p>
      </div>

      {/* Current usage */}
      <div className="grid grid-cols-1 gap-4 mb-8 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Active VMs" value={String(stats.vms)} icon={Server} />
        <StatCard label="Active Clusters" value={String(stats.clusters)} icon={Zap} />
        <StatCard label="Current Plan" value={stats.plan} icon={CreditCard} />
      </div>

      {/* Plans */}
      <h2 className="text-lg font-semibold mb-4">Cloud VM Plans</h2>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                'rounded-xl border p-6 bg-card transition-colors relative',
                plan.popular
                  ? 'border-primary ring-1 ring-primary'
                  : 'hover:border-primary/30',
              )}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-4 px-2 py-0.5 bg-primary text-primary-foreground text-xs font-medium rounded-full flex items-center gap-1">
                  <Star className="h-3 w-3" /> Most Popular
                </div>
              )}
              <h3 className="text-lg font-semibold mb-0.5">{plan.name}</h3>
              <p className="text-xs text-muted-foreground mb-3">{plan.description}</p>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-2xl font-bold">${plan.priceMonthly}</span>
                <span className="text-muted-foreground text-sm">/mo</span>
              </div>
              <div className="space-y-1.5 text-sm text-muted-foreground">
                <p>{plan.vcpus} vCPU ({plan.cpuType})</p>
                <p>{plan.memoryGB} GB RAM</p>
                <p>{plan.diskGB} GB SSD</p>
                <p>Up to {plan.maxVMs} VM{plan.maxVMs > 1 ? 's' : ''}</p>
              </div>
              {plan.freeTier && (
                <div className="mt-2 text-xs text-green-500 font-medium">$5 free credit included</div>
              )}
              <Button variant={plan.popular ? 'default' : 'outline'} size="sm" className="mt-4 w-full">
                Select Plan
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Additional pricing info */}
      <div className="mt-8 rounded-xl border p-6 bg-card">
        <h3 className="text-sm font-semibold mb-3">Included with all plans</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-muted-foreground">
          <div>Zero egress fees</div>
          <div>DDoS protection</div>
          <div>Automated backups</div>
          <div>IPv4 + IPv6</div>
        </div>
      </div>
    </div>
  )
}
