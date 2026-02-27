'use client'

import { useEffect, useState } from 'react'
import {
  Brain,
  Check,
  ExternalLink,
  Loader2,
  Sparkles,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@hanzo/ui/primitives'

interface AIModel {
  id: string
  name: string
  provider: string
  category: string
  contextWindow: number
  inputPricePer1M: number
  outputPricePer1M: number
  available: boolean
  description: string
}

const PROVIDER_COLORS: Record<string, string> = {
  hanzo: 'from-violet-500/20 to-fuchsia-500/20 border-violet-500/30',
  anthropic: 'from-orange-500/20 to-amber-500/20 border-orange-500/30',
  openai: 'from-emerald-500/20 to-green-500/20 border-emerald-500/30',
  google: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30',
  deepseek: 'from-sky-500/20 to-indigo-500/20 border-sky-500/30',
}

const PROVIDER_BADGES: Record<string, string> = {
  hanzo: 'bg-violet-500/15 text-violet-300 ring-violet-500/20',
  anthropic: 'bg-orange-500/15 text-orange-300 ring-orange-500/20',
  openai: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/20',
  google: 'bg-blue-500/15 text-blue-300 ring-blue-500/20',
  deepseek: 'bg-sky-500/15 text-sky-300 ring-sky-500/20',
}

function formatContext(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(0)}M`
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(0)}K`
  return String(tokens)
}

function ModelCard({ model }: { model: AIModel }) {
  const colors = PROVIDER_COLORS[model.provider] || 'from-zinc-500/20 to-zinc-500/20 border-zinc-500/30'
  const badge = PROVIDER_BADGES[model.provider] || 'bg-zinc-500/15 text-zinc-300 ring-zinc-500/20'
  const isHanzo = model.provider === 'hanzo'

  return (
    <div
      className={cn(
        'group relative rounded-xl border bg-gradient-to-br p-5 transition-all duration-200',
        'hover:scale-[1.01] hover:shadow-lg hover:shadow-black/20',
        colors,
        !model.available && 'opacity-50',
      )}
    >
      {isHanzo && (
        <div className="absolute -top-2.5 right-4 flex items-center gap-1 rounded-full bg-violet-500 px-2 py-0.5 text-[10px] font-semibold text-white">
          <Sparkles className="h-2.5 w-2.5" /> Hanzo
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h3 className="text-base font-semibold text-white">{model.name}</h3>
          <p className="mt-0.5 text-xs text-zinc-400">{model.description}</p>
        </div>
        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1', badge)}>
          {model.provider}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Context</p>
          <p className="mt-0.5 text-sm font-medium text-zinc-200">{formatContext(model.contextWindow)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Input</p>
          <p className="mt-0.5 text-sm font-medium text-zinc-200">${model.inputPricePer1M.toFixed(2)}<span className="text-zinc-500">/1M</span></p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Output</p>
          <p className="mt-0.5 text-sm font-medium text-zinc-200">${model.outputPricePer1M.toFixed(2)}<span className="text-zinc-500">/1M</span></p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {model.available ? (
            <>
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="text-[11px] text-emerald-400">Available</span>
            </>
          ) : (
            <>
              <div className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
              <span className="text-[11px] text-zinc-500">Coming soon</span>
            </>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-zinc-400 hover:text-white"
          disabled={!model.available}
        >
          Use Model
          <Zap className="ml-1 h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}

export default function ModelsPage() {
  const [models, setModels] = useState<AIModel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    fetch('/api/v1/pricing/ai/models')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data) => {
        setModels(data?.models ?? [])
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const providers = ['all', ...new Set(models.map((m) => m.provider))]
  const filtered = filter === 'all' ? models : models.filter((m) => m.provider === filter)

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">AI Models</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Access frontier AI models through a unified API. Pay per token, no commitments.
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white">
          <ExternalLink className="h-3.5 w-3.5" />
          API Docs
        </Button>
      </div>

      {/* Provider filter */}
      <div className="mb-6 flex flex-wrap gap-2">
        {providers.map((p) => (
          <button
            key={p}
            onClick={() => setFilter(p)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-all',
              filter === p
                ? 'bg-white text-zinc-900'
                : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200',
            )}
          >
            {p === 'all' ? 'All Providers' : p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-600" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          Failed to load models: {error}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((model) => (
            <ModelCard key={model.id} model={model} />
          ))}
        </div>
      )}

      {/* API access info */}
      <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <h3 className="text-sm font-semibold text-zinc-200">Quick Start</h3>
        <p className="mt-1 text-xs text-zinc-500">
          All models are accessible via the OpenAI-compatible API at{' '}
          <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-300">api.hanzo.ai/v1</code>
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-zinc-950 p-3 text-xs text-zinc-400">
          <code>{`curl https://api.hanzo.ai/v1/chat/completions \\
  -H "Authorization: Bearer \$HANZO_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model": "zen-72b", "messages": [{"role": "user", "content": "Hello"}]}'`}</code>
        </pre>
      </div>
    </div>
  )
}
