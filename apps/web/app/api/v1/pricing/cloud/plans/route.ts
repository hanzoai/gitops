import { NextResponse } from 'next/server'

const DO_API = 'https://api.digitalocean.com/v2'
const MARKUP_PERCENT = parseFloat(process.env.PAAS_MARKUP_PERCENT || '20')

/**
 * Canonical cloud VM tiers — matches marketing across
 * platform.hanzo.ai, visor.hanzo.ai, and base.hanzo.ai.
 *
 * Each tier maps to a DigitalOcean droplet size slug.
 * Pricing = DO base price + markup, rounded to marketing price.
 */
const PLAN_TIERS = [
  {
    id: 'nano',
    name: 'Nano',
    slug: 's-1vcpu-512mb',
    description: 'Lightweight workloads, dev/test, small services',
    cpuType: 'shared',
    transferTB: 1,
    marketPrice: 5,
    marketHourly: 0.007,
    features: ['1 vCPU (shared)', '1 GB RAM', '25 GB NVMe SSD', '1 TB transfer', '$5 free credit'],
    freeTier: true,
    popular: false,
  },
  {
    id: 'starter',
    name: 'Starter',
    slug: 's-1vcpu-2gb',
    description: 'Small apps and personal projects',
    cpuType: 'shared',
    transferTB: 2,
    marketPrice: 6,
    marketHourly: 0.009,
    features: ['1 vCPU (shared)', '2 GB RAM', '50 GB NVMe SSD', '2 TB transfer'],
    freeTier: false,
    popular: false,
  },
  {
    id: 'standard',
    name: 'Standard',
    slug: 's-2vcpu-4gb',
    description: 'Production web apps, APIs, databases',
    cpuType: 'shared',
    transferTB: 4,
    marketPrice: 12,
    marketHourly: 0.018,
    features: ['2 vCPUs (shared)', '4 GB RAM', '80 GB NVMe SSD', '4 TB transfer', 'Automated backups'],
    freeTier: false,
    popular: true,
  },
  {
    id: 'performance',
    name: 'Performance',
    slug: 's-4vcpu-8gb',
    description: 'High-traffic apps, CI/CD runners',
    cpuType: 'shared',
    transferTB: 5,
    marketPrice: 24,
    marketHourly: 0.036,
    features: ['4 vCPUs (shared)', '8 GB RAM', '160 GB NVMe SSD', '5 TB transfer', 'Automated backups', 'Priority support'],
    freeTier: false,
    popular: false,
  },
  {
    id: 'premium',
    name: 'Premium',
    slug: 'c-4',
    description: 'Dedicated cores for consistent performance',
    cpuType: 'dedicated',
    transferTB: 6,
    marketPrice: 36,
    marketHourly: 0.054,
    features: ['4 vCPUs (dedicated)', '8 GB RAM', '200 GB NVMe SSD', '6 TB transfer', 'Automated backups', 'Priority support', 'Private networking'],
    freeTier: false,
    popular: false,
  },
  {
    id: 'power',
    name: 'Power',
    slug: 'c-4-16gib',
    description: 'Compute-heavy workloads, ML inference',
    cpuType: 'dedicated',
    transferTB: 7,
    marketPrice: 49,
    marketHourly: 0.073,
    features: ['4 vCPUs (dedicated)', '16 GB RAM', '320 GB NVMe SSD', '7 TB transfer', 'Automated backups', 'Dedicated support', 'Private networking + VPC'],
    freeTier: false,
    popular: false,
  },
]

// Cache for 1 hour
let cache: { data: any; ts: number } | null = null
const CACHE_TTL = 60 * 60 * 1000

function buildFallback() {
  return PLAN_TIERS.map((tier) => ({
    id: tier.id,
    name: tier.name,
    description: tier.description,
    vcpus: parseInt(tier.slug.match(/(\d+)(?:vcpu|-)/)?.[1] || '1'),
    memoryGB: tier.id === 'nano' ? 1 : tier.id === 'starter' ? 2 : tier.id === 'standard' ? 4 : tier.id === 'performance' ? 8 : tier.id === 'premium' ? 8 : 16,
    diskGB: tier.id === 'nano' ? 25 : tier.id === 'starter' ? 50 : tier.id === 'standard' ? 80 : tier.id === 'performance' ? 160 : tier.id === 'premium' ? 200 : 320,
    cpuType: tier.cpuType,
    transferTB: tier.transferTB,
    priceMonthly: tier.marketPrice,
    priceHourly: tier.marketHourly,
    freeTier: tier.freeTier,
    popular: tier.popular,
    features: tier.features,
  }))
}

export async function GET() {
  // Return cached if fresh
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json({ plans: cache.data })
  }

  const token = process.env.DO_API_TOKEN
  if (!token) {
    return NextResponse.json({ plans: buildFallback() })
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

      // Use DO live data when available, otherwise use marketing price
      const monthly = doSize
        ? Math.round(doSize.price_monthly * (1 + MARKUP_PERCENT / 100))
        : tier.marketPrice
      const hourly = doSize
        ? Math.round(doSize.price_hourly * (1 + MARKUP_PERCENT / 100) * 100000) / 100000
        : tier.marketHourly

      return {
        id: tier.id,
        name: tier.name,
        description: tier.description,
        vcpus: doSize?.vcpus ?? (tier.id === 'nano' ? 1 : tier.id === 'starter' ? 1 : tier.id === 'standard' ? 2 : 4),
        memoryGB: doSize ? Math.round(doSize.memory / 1024) : (tier.id === 'nano' ? 1 : tier.id === 'starter' ? 2 : tier.id === 'standard' ? 4 : tier.id === 'performance' ? 8 : tier.id === 'premium' ? 8 : 16),
        diskGB: doSize?.disk ?? (tier.id === 'nano' ? 25 : tier.id === 'starter' ? 50 : tier.id === 'standard' ? 80 : tier.id === 'performance' ? 160 : tier.id === 'premium' ? 200 : 320),
        cpuType: tier.cpuType,
        transferTB: tier.transferTB,
        priceMonthly: monthly,
        priceHourly: hourly,
        freeTier: tier.freeTier,
        popular: tier.popular,
        features: tier.features,
      }
    })

    cache = { data: plans, ts: Date.now() }
    return NextResponse.json({ plans })
  } catch (err: any) {
    if (cache) return NextResponse.json({ plans: cache.data })
    return NextResponse.json({ plans: buildFallback() })
  }
}
