import { NextResponse } from 'next/server'

const DO_API = 'https://api.digitalocean.com/v2'

// Cache for 1 hour
let cache: { data: any; ts: number } | null = null
const CACHE_TTL = 60 * 60 * 1000

const FALLBACK_REGIONS = [
  { id: 'nyc1', name: 'New York 1', location: 'New York City, US', available: true },
  { id: 'nyc3', name: 'New York 3', location: 'New York City, US', available: true },
  { id: 'sfo3', name: 'San Francisco 3', location: 'San Francisco, US', available: true },
  { id: 'ams3', name: 'Amsterdam 3', location: 'Amsterdam, NL', available: true },
  { id: 'sgp1', name: 'Singapore 1', location: 'Singapore', available: true },
  { id: 'lon1', name: 'London 1', location: 'London, UK', available: true },
  { id: 'fra1', name: 'Frankfurt 1', location: 'Frankfurt, DE', available: true },
  { id: 'tor1', name: 'Toronto 1', location: 'Toronto, CA', available: true },
  { id: 'blr1', name: 'Bangalore 1', location: 'Bangalore, IN', available: true },
  { id: 'syd1', name: 'Sydney 1', location: 'Sydney, AU', available: true },
]

export async function GET() {
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json({ regions: cache.data })
  }

  const token = process.env.DO_API_TOKEN
  if (!token) {
    return NextResponse.json({ regions: FALLBACK_REGIONS })
  }

  try {
    const res = await fetch(`${DO_API}/regions`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      next: { revalidate: 3600 },
    })

    if (!res.ok) throw new Error(`DO API ${res.status}`)

    const data = await res.json()
    const regions = data.regions
      .filter((r: any) => r.available && r.features.includes('kubernetes'))
      .map((r: any) => ({
        id: r.slug,
        name: r.name,
        location: r.name,
        available: r.available,
      }))

    cache = { data: regions, ts: Date.now() }
    return NextResponse.json({ regions })
  } catch {
    if (cache) return NextResponse.json({ regions: cache.data })
    return NextResponse.json({ regions: FALLBACK_REGIONS })
  }
}
