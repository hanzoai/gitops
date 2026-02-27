import { NextResponse } from 'next/server'

const DO_API = 'https://api.digitalocean.com/v2'
const MARKUP_PERCENT = parseFloat(process.env.PAAS_MARKUP_PERCENT || '20')

// Plan tier definitions mapping DO sizes to user-facing plans
const PLAN_TIERS = [
  {
    id: 'starter',
    name: 'Starter',
    slug: 's-1vcpu-1gb',
    description: 'Perfect for development and testing',
    cpuType: 'Shared',
    maxVMs: 3,
    freeTier: true,
    popular: false,
    features: ['1 vCPU (shared)', '1 GB RAM', '25 GB SSD', '1 TB transfer', '$5 free credit'],
  },
  {
    id: 'basic',
    name: 'Basic',
    slug: 's-1vcpu-2gb',
    description: 'Small apps and lightweight services',
    cpuType: 'Shared',
    maxVMs: 5,
    freeTier: false,
    popular: false,
    features: ['1 vCPU (shared)', '2 GB RAM', '50 GB SSD', '2 TB transfer'],
  },
  {
    id: 'standard',
    name: 'Standard',
    slug: 's-2vcpu-4gb',
    description: 'Production workloads and APIs',
    cpuType: 'Shared',
    maxVMs: 10,
    freeTier: false,
    popular: true,
    features: ['2 vCPUs (shared)', '4 GB RAM', '80 GB SSD', '4 TB transfer', 'Automated backups'],
  },
  {
    id: 'performance',
    name: 'Performance',
    slug: 's-4vcpu-8gb',
    description: 'High-traffic apps and databases',
    cpuType: 'Shared',
    maxVMs: 20,
    freeTier: false,
    popular: false,
    features: [
      '4 vCPUs (shared)',
      '8 GB RAM',
      '160 GB SSD',
      '5 TB transfer',
      'Automated backups',
      'Priority support',
    ],
  },
  {
    id: 'pro',
    name: 'Professional',
    slug: 's-8vcpu-16gb-amd',
    description: 'Dedicated compute for demanding workloads',
    cpuType: 'AMD',
    maxVMs: 50,
    freeTier: false,
    popular: false,
    features: [
      '8 vCPUs (AMD)',
      '16 GB RAM',
      '320 GB NVMe SSD',
      '6 TB transfer',
      'Automated backups',
      'Priority support',
      '99.99% SLA',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    slug: 'c-16-intel',
    description: 'Maximum performance for enterprise',
    cpuType: 'Intel Dedicated',
    maxVMs: 100,
    freeTier: false,
    popular: false,
    features: [
      '16 vCPUs (Intel dedicated)',
      '32 GB RAM',
      '500 GB NVMe SSD',
      '8 TB transfer',
      'Automated backups',
      'Dedicated support',
      '99.99% SLA',
      'Custom networking',
    ],
  },
]

// Cache for 1 hour
let cache: { data: any; ts: number } | null = null
const CACHE_TTL = 60 * 60 * 1000

export async function GET() {
  // Return cached if fresh
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json({ plans: cache.data })
  }

  const token = process.env.DO_API_TOKEN
  if (!token) {
    // Return plans with estimated pricing when no DO token
    const fallback = PLAN_TIERS.map((tier) => ({
      id: tier.id,
      name: tier.name,
      description: tier.description,
      vcpus: parseInt(tier.slug.match(/(\d+)vcpu/)?.[1] || '1'),
      memoryGB: parseInt(tier.slug.match(/(\d+)gb/)?.[1] || '1'),
      diskGB: tier.id === 'starter' ? 25 : tier.id === 'basic' ? 50 : tier.id === 'standard' ? 80 : tier.id === 'performance' ? 160 : tier.id === 'pro' ? 320 : 500,
      cpuType: tier.cpuType,
      maxVMs: tier.maxVMs,
      priceMonthly: tier.id === 'starter' ? 6 : tier.id === 'basic' ? 14 : tier.id === 'standard' ? 29 : tier.id === 'performance' ? 58 : tier.id === 'pro' ? 115 : 384,
      priceHourly: tier.id === 'starter' ? 0.009 : tier.id === 'basic' ? 0.021 : tier.id === 'standard' ? 0.043 : tier.id === 'performance' ? 0.086 : tier.id === 'pro' ? 0.171 : 0.571,
      freeTier: tier.freeTier,
      popular: tier.popular,
      features: tier.features,
    }))
    return NextResponse.json({ plans: fallback })
  }

  try {
    const res = await fetch(`${DO_API}/sizes?per_page=200`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      next: { revalidate: 3600 },
    })

    if (!res.ok) throw new Error(`DO API ${res.status}`)

    const data = await res.json()
    const doSizes = data.sizes as any[]

    const plans = PLAN_TIERS.map((tier) => {
      const doSize = doSizes.find((s: any) => s.slug === tier.slug)
      if (!doSize) return null

      const monthly = Math.round(doSize.price_monthly * (1 + MARKUP_PERCENT / 100) * 100) / 100
      const hourly = Math.round(doSize.price_hourly * (1 + MARKUP_PERCENT / 100) * 100000) / 100000

      return {
        id: tier.id,
        name: tier.name,
        description: tier.description,
        vcpus: doSize.vcpus,
        memoryGB: Math.round(doSize.memory / 1024),
        diskGB: doSize.disk,
        cpuType: tier.cpuType,
        maxVMs: tier.maxVMs,
        priceMonthly: monthly,
        priceHourly: hourly,
        freeTier: tier.freeTier,
        popular: tier.popular,
        features: tier.features,
      }
    }).filter(Boolean)

    cache = { data: plans, ts: Date.now() }
    return NextResponse.json({ plans })
  } catch (err: any) {
    // On DO API failure, return cached if available, otherwise fallback
    if (cache) return NextResponse.json({ plans: cache.data })

    return NextResponse.json(
      { error: 'Failed to fetch pricing', message: err.message },
      { status: 502 }
    )
  }
}
