'use client'

import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  className,
}: {
  label: string
  value: string | number
  icon?: LucideIcon
  trend?: { value: number; label: string }
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card p-6 transition-colors hover:bg-accent/30',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className="mt-2 flex items-end gap-2">
        <p className="text-3xl font-bold tracking-tight">{value}</p>
        {trend && (
          <span
            className={cn(
              'mb-1 text-xs font-medium',
              trend.value >= 0 ? 'text-emerald-400' : 'text-red-400',
            )}
          >
            {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
          </span>
        )}
      </div>
    </div>
  )
}
