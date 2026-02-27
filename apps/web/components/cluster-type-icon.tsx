'use client'

import { Cloud, Server, Container } from 'lucide-react'
import { cn } from '@/lib/utils'

const typeMap = {
  kubernetes:       { icon: Cloud,     label: 'Kubernetes', color: 'text-blue-400' },
  'docker-swarm':   { icon: Server,    label: 'Docker Swarm', color: 'text-purple-400' },
  'docker-compose': { icon: Container, label: 'Docker Compose', color: 'text-cyan-400' },
} as const

type ClusterType = keyof typeof typeMap

export function ClusterTypeIcon({
  type,
  showLabel = false,
  className,
}: {
  type: string
  showLabel?: boolean
  className?: string
}) {
  const key = (type in typeMap ? type : 'kubernetes') as ClusterType
  const config = typeMap[key]
  const Icon = config.icon

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <Icon className={cn('h-4 w-4', config.color)} />
      {showLabel && <span className="text-sm">{config.label}</span>}
    </span>
  )
}
