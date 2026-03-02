import { NextResponse } from 'next/server'

const LLM_GATEWAY = process.env.LLM_GATEWAY_URL || 'http://llm.hanzo.svc.cluster.local:4000'

// AI model pricing — real Hanzo gateway pricing
const AI_MODELS = [
  // Zen Models (Hanzo's own)
  {
    id: 'zen-1b',
    name: 'Zen 1B',
    provider: 'hanzo',
    category: 'text',
    contextWindow: 32768,
    inputPricePer1M: 0.10,
    outputPricePer1M: 0.30,
    available: true,
    description: 'Fast, efficient model for simple tasks',
  },
  {
    id: 'zen-7b',
    name: 'Zen 7B',
    provider: 'hanzo',
    category: 'text',
    contextWindow: 131072,
    inputPricePer1M: 0.25,
    outputPricePer1M: 0.75,
    available: true,
    description: 'Balanced performance and cost',
  },
  {
    id: 'zen-72b',
    name: 'Zen 72B',
    provider: 'hanzo',
    category: 'text',
    contextWindow: 131072,
    inputPricePer1M: 0.90,
    outputPricePer1M: 2.70,
    available: true,
    description: 'High-performance reasoning model',
  },
  {
    id: 'zen-480b',
    name: 'Zen 480B MoDE',
    provider: 'hanzo',
    category: 'text',
    contextWindow: 1048576,
    inputPricePer1M: 2.00,
    outputPricePer1M: 6.00,
    available: true,
    description: 'Frontier-class Mixture of Diverse Experts',
  },
  // Third-party via LLM Gateway
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    provider: 'anthropic',
    category: 'text',
    contextWindow: 200000,
    inputPricePer1M: 3.00,
    outputPricePer1M: 15.00,
    available: true,
    description: 'Anthropic latest Sonnet',
  },
  {
    id: 'claude-opus-4-6',
    name: 'Claude Opus 4.6',
    provider: 'anthropic',
    category: 'text',
    contextWindow: 200000,
    inputPricePer1M: 15.00,
    outputPricePer1M: 75.00,
    available: true,
    description: 'Anthropic most capable model',
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    category: 'text',
    contextWindow: 128000,
    inputPricePer1M: 2.50,
    outputPricePer1M: 10.00,
    available: true,
    description: 'OpenAI multimodal flagship',
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    category: 'text',
    contextWindow: 128000,
    inputPricePer1M: 0.15,
    outputPricePer1M: 0.60,
    available: true,
    description: 'OpenAI fast and affordable',
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'google',
    category: 'text',
    contextWindow: 1048576,
    inputPricePer1M: 1.25,
    outputPricePer1M: 5.00,
    available: true,
    description: 'Google 1M context reasoning model',
  },
  {
    id: 'deepseek-r1',
    name: 'DeepSeek R1',
    provider: 'deepseek',
    category: 'text',
    contextWindow: 131072,
    inputPricePer1M: 0.55,
    outputPricePer1M: 2.19,
    available: true,
    description: 'Open-weight reasoning model',
  },
]

export async function GET() {
  // Try to fetch live model list from LLM Gateway
  try {
    const res = await fetch(`${LLM_GATEWAY}/v1/models`, {
      headers: { Authorization: `Bearer ${process.env.LLM_API_KEY || ''}` },
      next: { revalidate: 300 }, // 5 min cache
    })
    if (res.ok) {
      const data = await res.json()
      // Merge live availability with our pricing
      if (data?.data) {
        const liveIds = new Set(data.data.map((m: any) => m.id))
        const models = AI_MODELS.map((m) => ({
          ...m,
          available: liveIds.has(m.id) || m.provider === 'hanzo',
        }))
        return NextResponse.json({ models })
      }
    }
  } catch {
    // Gateway not reachable — return static pricing
  }

  return NextResponse.json({ models: AI_MODELS })
}
