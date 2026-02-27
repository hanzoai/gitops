'use client'

import { useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

// Minimal ANSI color map for terminal output
const ANSI_COLORS: Record<string, string> = {
  '30': 'text-zinc-500',
  '31': 'text-red-400',
  '32': 'text-emerald-400',
  '33': 'text-amber-400',
  '34': 'text-blue-400',
  '35': 'text-purple-400',
  '36': 'text-cyan-400',
  '37': 'text-zinc-200',
  '90': 'text-zinc-500',
  '91': 'text-red-300',
  '92': 'text-emerald-300',
  '93': 'text-amber-300',
  '94': 'text-blue-300',
  '95': 'text-purple-300',
  '96': 'text-cyan-300',
  '97': 'text-white',
  '1':  'font-bold',
  '2':  'opacity-60',
}

function parseAnsi(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  // eslint-disable-next-line no-control-regex
  const regex = /\x1b\[([0-9;]*)m/g
  let lastIndex = 0
  let currentClasses: string[] = []
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    // Push text before this escape
    if (match.index > lastIndex) {
      const segment = text.slice(lastIndex, match.index)
      parts.push(
        currentClasses.length > 0 ? (
          <span key={parts.length} className={currentClasses.join(' ')}>
            {segment}
          </span>
        ) : (
          segment
        ),
      )
    }

    const codes = match[1].split(';')
    for (const code of codes) {
      if (code === '0' || code === '') {
        currentClasses = []
      } else if (ANSI_COLORS[code]) {
        currentClasses.push(ANSI_COLORS[code])
      }
    }

    lastIndex = regex.lastIndex
  }

  // Push remaining text
  if (lastIndex < text.length) {
    const segment = text.slice(lastIndex)
    parts.push(
      currentClasses.length > 0 ? (
        <span key={parts.length} className={currentClasses.join(' ')}>
          {segment}
        </span>
      ) : (
        segment
      ),
    )
  }

  return parts
}

export function Terminal({
  lines,
  title = 'Logs',
  maxHeight = '400px',
  className,
  follow = true,
}: {
  lines: string[]
  title?: string
  maxHeight?: string
  className?: string
  follow?: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (follow && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [lines, follow])

  return (
    <div className={cn('overflow-hidden rounded-lg border border-border', className)}>
      {/* Title bar */}
      <div className="flex items-center gap-2 border-b border-border bg-zinc-950 px-4 py-2">
        <div className="flex gap-1.5">
          <div className="h-3 w-3 rounded-full bg-zinc-700" />
          <div className="h-3 w-3 rounded-full bg-zinc-700" />
          <div className="h-3 w-3 rounded-full bg-zinc-700" />
        </div>
        <span className="ml-2 text-xs font-medium text-zinc-500">{title}</span>
      </div>
      {/* Log content */}
      <div
        ref={containerRef}
        className="overflow-auto bg-zinc-950 p-4 font-mono text-[13px] leading-5 text-zinc-300"
        style={{ maxHeight }}
      >
        {lines.length === 0 ? (
          <p className="text-zinc-600">Waiting for logs...</p>
        ) : (
          lines.map((line, i) => (
            <div key={i} className="flex">
              <span className="mr-4 select-none text-zinc-600">
                {String(i + 1).padStart(4, ' ')}
              </span>
              <span className="flex-1 whitespace-pre-wrap break-all">{parseAnsi(line)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
