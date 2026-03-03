'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { useSession, signOut } from 'next-auth/react'
import {
  Boxes,
  Brain,
  Building2,
  Check,
  ChevronRight,
  ChevronsUpDown,
  CreditCard,
  GitBranch,
  Globe,
  LogOut,
  Menu,
  Monitor,
  Network,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Server,
  Settings,
  User,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Separator,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@hanzo/ui/primitives'
import { trpc } from '@/lib/trpc'

const LS_KEY = 'paas-selected-org'

const navItems = [
  { href: '/orgs', label: 'Organizations', icon: Building2 },
  { href: '/repos', label: 'Repositories', icon: GitBranch },
  { href: '/clusters', label: 'Fleet', icon: Server },
  { href: '/vms', label: 'Virtual Machines', icon: Monitor },
  { href: '/models', label: 'AI Models', icon: Brain },
  { href: '/registries', label: 'Registries', icon: Package },
  { href: '/gateway', label: 'Gateway', icon: Globe },
  { href: '/ingress', label: 'Ingress', icon: Network },
  { href: '/billing', label: 'Billing', icon: CreditCard },
  { href: '/settings', label: 'Settings', icon: Settings },
]

function Breadcrumbs() {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)

  if (segments.length === 0) return null

  const crumbs = segments.map((seg, i) => {
    const href = '/' + segments.slice(0, i + 1).join('/')
    const label = seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ')
    const isLast = i === segments.length - 1
    return { href, label, isLast }
  })

  return (
    <nav className="flex items-center gap-1.5 text-sm">
      {crumbs.map((crumb, i) => (
        <span key={crumb.href} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-muted-foreground/50">/</span>}
          {crumb.isLast ? (
            <span className="font-medium text-foreground">{crumb.label}</span>
          ) : (
            <Link
              href={crumb.href}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  )
}

function getInitials(name?: string | null, email?: string | null): string {
  if (name) {
    return name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }
  if (email) {
    return email.slice(0, 2).toUpperCase()
  }
  return '??'
}

function NavLink({
  item,
  pathname,
  collapsed,
  onClick,
}: {
  item: (typeof navItems)[0]
  pathname: string
  collapsed: boolean
  onClick?: () => void
}) {
  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150',
        collapsed && 'justify-center px-2',
        isActive
          ? 'bg-white/[0.08] text-white font-medium'
          : 'text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200',
      )}
    >
      <item.icon className={cn('h-4 w-4 shrink-0', isActive && 'text-white')} />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  )
}

function OrgSwitcher({
  collapsed,
  onNavClick,
}: {
  collapsed: boolean
  onNavClick?: () => void
}) {
  const router = useRouter()
  const { data: orgs } = trpc.organization.list.useQuery()
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null)

  // Load persisted selection on mount
  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY)
    if (stored) setSelectedOrgId(stored)
  }, [])

  // Auto-select first org if none selected and orgs are loaded
  useEffect(() => {
    if (orgs && orgs.length > 0 && !selectedOrgId) {
      const first = orgs[0].id
      setSelectedOrgId(first)
      localStorage.setItem(LS_KEY, first)
    }
  }, [orgs, selectedOrgId])

  const selectedOrg = orgs?.find((o) => o.id === selectedOrgId) ?? orgs?.[0]
  const orgInitials = selectedOrg
    ? selectedOrg.name
        .split(/\s+/)
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '??'

  const handleSelect = useCallback(
    (orgId: string) => {
      setSelectedOrgId(orgId)
      localStorage.setItem(LS_KEY, orgId)
      onNavClick?.()
      router.push(`/orgs/${orgId}`)
    },
    [router, onNavClick],
  )

  return (
    <div
      className={cn(
        'border-b border-white/[0.06]',
        collapsed ? 'px-2 py-2' : 'px-2 py-2',
      )}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-white/[0.05]',
              collapsed && 'justify-center',
            )}
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-white/10 to-white/[0.03] ring-1 ring-white/10">
              <span className="text-[10px] font-semibold text-zinc-300">
                {orgInitials}
              </span>
            </div>
            {!collapsed && (
              <>
                <span className="flex-1 truncate text-left text-[13px] font-medium text-zinc-200">
                  {selectedOrg?.name ?? 'Select org'}
                </span>
                <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
              </>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          side={collapsed ? 'right' : 'bottom'}
          className="w-56 bg-zinc-900 border-zinc-800"
        >
          <DropdownMenuLabel className="text-xs font-medium text-zinc-500">
            Organizations
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-zinc-800" />
          {orgs?.map((org) => {
            const initials = org.name
              .split(/\s+/)
              .map((w) => w[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)
            const isSelected = org.id === selectedOrg?.id
            return (
              <DropdownMenuItem
                key={org.id}
                className="text-zinc-300 focus:bg-white/[0.05] focus:text-white"
              >
                <button
                  type="button"
                  className="flex w-full items-center"
                  onClick={() => handleSelect(org.id)}
                >
                  <div className="mr-2 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-zinc-800 text-[9px] font-semibold text-zinc-400 ring-1 ring-white/[0.06]">
                    {initials}
                  </div>
                  <span className="flex-1 truncate text-left">{org.name}</span>
                  {isSelected && (
                    <Check className="ml-2 h-3.5 w-3.5 shrink-0 text-zinc-400" />
                  )}
                </button>
              </DropdownMenuItem>
            )
          })}
          {(!orgs || orgs.length === 0) && (
            <DropdownMenuLabel className="text-zinc-600 text-xs font-normal">
              No organizations
            </DropdownMenuLabel>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function SidebarContent({
  pathname,
  collapsed,
  setCollapsed,
  session,
  onNavClick,
}: {
  pathname: string
  collapsed: boolean
  setCollapsed: (v: boolean) => void
  session: any
  onNavClick?: () => void
}) {
  const userName = session?.user?.name || session?.user?.email || 'User'
  const userEmail = session?.user?.email || ''
  const userImage = session?.user?.image || ''
  const userInitials = getInitials(session?.user?.name, session?.user?.email)

  return (
    <>
      {/* Logo */}
      <div
        className={cn(
          'flex h-12 shrink-0 items-center border-b border-white/[0.06]',
          collapsed ? 'justify-center px-2' : 'px-4',
        )}
      >
        <Link href="/orgs" className="flex items-center gap-2.5" onClick={onNavClick}>
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-white/15 to-white/5 ring-1 ring-white/10">
            <Boxes className="h-3.5 w-3.5 text-white" />
          </div>
          {!collapsed && (
            <span className="text-[14px] font-semibold tracking-tight text-white">
              Hanzo
            </span>
          )}
        </Link>
      </div>

      {/* Org switcher */}
      <OrgSwitcher collapsed={collapsed} onNavClick={onNavClick} />

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {navItems.map((item) => {
          const link = (
            <NavLink
              key={item.href}
              item={item}
              pathname={pathname}
              collapsed={collapsed}
              onClick={onNavClick}
            />
          )

          if (collapsed) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right" className="bg-zinc-800 text-zinc-200 border-zinc-700">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            )
          }

          return <div key={item.href}>{link}</div>
        })}
      </nav>

      {/* Collapse toggle - desktop only */}
      <div className="hidden lg:block">
        <Separator className="bg-white/[0.06]" />
        <div className="p-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex w-full items-center justify-center rounded-lg px-3 py-2 text-sm text-zinc-500 transition-colors hover:bg-white/[0.05] hover:text-zinc-300"
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <div className="flex w-full items-center gap-3">
                <PanelLeftClose className="h-4 w-4" />
                <span>Collapse</span>
              </div>
            )}
          </button>
        </div>
      </div>

      {/* User section */}
      <div className={cn('border-t border-white/[0.06] p-2', collapsed && 'flex justify-center')}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-white/[0.05]',
                collapsed && 'justify-center px-2',
              )}
            >
              <Avatar className="h-6 w-6 ring-1 ring-white/10">
                <AvatarImage src={userImage} />
                <AvatarFallback className="bg-zinc-800 text-[10px] font-medium text-zinc-300">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium leading-tight text-zinc-200">{userName}</p>
                    {userEmail && userName !== userEmail && (
                      <p className="text-[11px] text-zinc-500">{userEmail}</p>
                    )}
                  </div>
                  <ChevronsUpDown className="h-3.5 w-3.5 text-zinc-600" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align={collapsed ? 'center' : 'end'}
            side={collapsed ? 'right' : 'top'}
            className="w-56 bg-zinc-900 border-zinc-800"
          >
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-zinc-200">{userName}</p>
                {userEmail && (
                  <p className="text-xs text-zinc-500">{userEmail}</p>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-zinc-800" />
            <DropdownMenuItem className="text-zinc-300 focus:bg-white/[0.05] focus:text-white">
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem className="text-zinc-300 focus:bg-white/[0.05] focus:text-white">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-zinc-800" />
            <DropdownMenuItem className="text-red-400 focus:bg-red-500/10 focus:text-red-400">
              <button
                type="button"
                className="flex w-full items-center"
                onClick={() => signOut({ callbackUrl: '/' })}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { data: session } = useSession()

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-screen overflow-hidden bg-zinc-950">
        {/* Mobile overlay */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Mobile sidebar */}
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-zinc-950 border-r border-white/[0.06] transition-transform duration-200 lg:hidden',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="absolute right-2 top-3">
            <button
              onClick={() => setMobileOpen(false)}
              className="rounded-md p-1.5 text-zinc-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <SidebarContent
            pathname={pathname}
            collapsed={false}
            setCollapsed={setCollapsed}
            session={session}
            onNavClick={() => setMobileOpen(false)}
          />
        </aside>

        {/* Desktop sidebar */}
        <aside
          className={cn(
            'hidden lg:flex flex-col border-r border-white/[0.06] bg-zinc-950 transition-all duration-200',
            collapsed ? 'w-16' : 'w-56',
          )}
        >
          <SidebarContent
            pathname={pathname}
            collapsed={collapsed}
            setCollapsed={setCollapsed}
            session={session}
          />
        </aside>

        {/* Main area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top bar */}
          <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/[0.06] bg-zinc-950 px-4 lg:px-6">
            <div className="flex items-center gap-3">
              {/* Mobile menu button */}
              <button
                onClick={() => setMobileOpen(true)}
                className="rounded-md p-1.5 text-zinc-400 hover:text-white lg:hidden"
              >
                <Menu className="h-4 w-4" />
              </button>
              <Breadcrumbs />
            </div>
            <div className="flex items-center gap-2">
              {/* Future: notifications, search, etc */}
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto bg-zinc-950">
            <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-8">{children}</div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}
