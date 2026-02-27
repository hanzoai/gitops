'use client'

import { cn } from '@/lib/utils'

type Status = 'running' | 'provisioning' | 'error' | 'stopped' | 'creating' | 'deleting' | 'unknown'

const statusConfig: Record<Status, { color: string; pulse: boolean; label: string }> = {
  running:      { color: 'bg-emerald-500', pulse: false, label: 'Running' },
  provisioning: { color: 'bg-amber-500',   pulse: true,  label: 'Provisioning' },
  creating:     { color: 'bg-amber-500',   pulse: true,  label: 'Creating' },
  deleting:     { color: 'bg-amber-500',   pulse: true,  label: 'Deleting' },
  error:        { color: 'bg-red-500',     pulse: false, label: 'Error' },
  stopped:      { color: 'bg-zinc-500',    pulse: false, label: 'Stopped' },
  unknown:      { color: 'bg-zinc-500',    pulse: false, label: 'Unknown' },
}

export function StatusBadge({
  status,
  className,
}: {
  status: string
  className?: string
}) {
  const key = (status.toLowerCase() in statusConfig ? status.toLowerCase() : 'unknown') as Status
  const config = statusConfig[key]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-2.5 py-0.5 text-xs font-medium',
        className,
      )}
    >
      <span className="relative flex h-2 w-2">
        {config.pulse && (
          <span
            className={cn(
              'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
              config.color,
            )}
          />
        )}
        <span className={cn('relative inline-flex h-2 w-2 rounded-full', config.color)} />
      </span>
      {config.label}
    </span>
  )
}
