declare module '@hanzo/ui' {
  export function cn(...inputs: any[]): string
  // Re-export all primitives
  export * from '@hanzo/ui/primitives'
}

declare module '@hanzo/ui/primitives' {
  import type { ComponentProps, FC, ReactNode } from 'react'

  // Button
  export const Button: FC<ComponentProps<'button'> & {
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
    size?: 'default' | 'sm' | 'lg' | 'icon'
    asChild?: boolean
    className?: string
    children?: ReactNode
  }>
  export const buttonVariants: any

  // Input
  export const Input: FC<ComponentProps<'input'> & { className?: string }>
  export const Textarea: FC<ComponentProps<'textarea'> & { className?: string }>

  // Avatar
  export const Avatar: FC<{ className?: string; children?: ReactNode }>
  export const AvatarImage: FC<{ src?: string; alt?: string; className?: string }>
  export const AvatarFallback: FC<{ className?: string; children?: ReactNode }>

  // Dialog
  export const Dialog: FC<{ open?: boolean; onOpenChange?: (v: boolean) => void; children?: ReactNode }>
  export const DialogTrigger: FC<{ asChild?: boolean; children?: ReactNode }>
  export const DialogContent: FC<{ className?: string; children?: ReactNode }>
  export const DialogHeader: FC<{ className?: string; children?: ReactNode }>
  export const DialogTitle: FC<{ className?: string; children?: ReactNode }>
  export const DialogDescription: FC<{ className?: string; children?: ReactNode }>
  export const DialogFooter: FC<{ className?: string; children?: ReactNode }>
  export const DialogOverlay: FC<{ className?: string }>
  export const DialogPortal: FC<{ children?: ReactNode }>

  // Dropdown Menu
  export const DropdownMenu: FC<{ children?: ReactNode }>
  export const DropdownMenuTrigger: FC<{ asChild?: boolean; children?: ReactNode }>
  export const DropdownMenuContent: FC<{ align?: string; side?: string; className?: string; children?: ReactNode }>
  export const DropdownMenuItem: FC<{ className?: string; children?: ReactNode }>
  export const DropdownMenuLabel: FC<{ className?: string; children?: ReactNode }>
  export const DropdownMenuSeparator: FC<{ className?: string }>
  export const DropdownMenuGroup: FC<{ children?: ReactNode }>
  export const DropdownMenuCheckboxItem: FC<any>
  export const DropdownMenuRadioGroup: FC<any>
  export const DropdownMenuRadioItem: FC<any>
  export const DropdownMenuSub: FC<any>
  export const DropdownMenuSubContent: FC<any>
  export const DropdownMenuSubTrigger: FC<any>
  export const DropdownMenuPortal: FC<any>
  export const DropdownMenuShortcut: FC<any>

  // Table
  export const Table: FC<{ className?: string; children?: ReactNode }>
  export const TableHeader: FC<{ className?: string; children?: ReactNode }>
  export const TableBody: FC<{ className?: string; children?: ReactNode }>
  export const TableRow: FC<{ className?: string; children?: ReactNode }>
  export const TableHead: FC<{ className?: string; children?: ReactNode }>
  export const TableCell: FC<{ className?: string; colSpan?: number; children?: ReactNode }>
  export const TableFooter: FC<{ className?: string; children?: ReactNode }>
  export const TableCaption: FC<{ className?: string; children?: ReactNode }>

  // Tabs
  export const Tabs: FC<{ defaultValue?: string; className?: string; children?: ReactNode }>
  export const TabsList: FC<{ className?: string; children?: ReactNode }>
  export const TabsTrigger: FC<{ value: string; className?: string; children?: ReactNode }>
  export const TabsContent: FC<{ value: string; className?: string; children?: ReactNode }>

  // Select
  export const Select: FC<{ defaultValue?: string; value?: string; onValueChange?: (v: string) => void; children?: ReactNode }>
  export const SelectTrigger: FC<{ className?: string; children?: ReactNode }>
  export const SelectValue: FC<{ placeholder?: string }>
  export const SelectContent: FC<{ className?: string; children?: ReactNode }>
  export const SelectItem: FC<{ value: string; className?: string; children?: ReactNode }>
  export const SelectGroup: FC<{ children?: ReactNode }>
  export const SelectLabel: FC<{ className?: string; children?: ReactNode }>
  export const SelectSeparator: FC<{ className?: string }>

  // Badge
  export const Badge: FC<{ variant?: string; className?: string; children?: ReactNode }>

  // Separator
  export const Separator: FC<{ className?: string; orientation?: 'horizontal' | 'vertical'; decorative?: boolean }>

  // Tooltip
  export const TooltipProvider: FC<{ delayDuration?: number; children?: ReactNode }>
  export const Tooltip: FC<{ children?: ReactNode }>
  export const TooltipTrigger: FC<{ asChild?: boolean; children?: ReactNode }>
  export const TooltipContent: FC<{ side?: string; className?: string; children?: ReactNode }>
  export const TooltipArrow: FC<any>
  export const TooltipPortal: FC<any>

  // Switch
  export const Switch: FC<{ defaultChecked?: boolean; checked?: boolean; onCheckedChange?: (v: boolean) => void; className?: string }>

  // ScrollArea
  export const ScrollArea: FC<{ className?: string; children?: ReactNode }>
  export const ScrollBar: FC<{ orientation?: string; className?: string }>

  // Sheet
  export const Sheet: FC<{ open?: boolean; onOpenChange?: (v: boolean) => void; children?: ReactNode }>
  export const SheetTrigger: FC<{ asChild?: boolean; children?: ReactNode }>
  export const SheetContent: FC<{ side?: string; className?: string; children?: ReactNode }>
  export const SheetHeader: FC<{ className?: string; children?: ReactNode }>
  export const SheetTitle: FC<{ className?: string; children?: ReactNode }>
  export const SheetDescription: FC<{ className?: string; children?: ReactNode }>
  export const SheetFooter: FC<{ className?: string; children?: ReactNode }>
  export const SheetClose: FC<{ className?: string; children?: ReactNode }>

  // Skeleton
  export const Skeleton: FC<{ className?: string }>

  // Progress
  export const Progress: FC<{ value?: number; className?: string }>

  // Slider
  export const Slider: FC<any>

  // Collapsible
  export const Collapsible: FC<any>
  export const CollapsibleTrigger: FC<any>
  export const CollapsibleContent: FC<any>

  // Label
  export const Label: FC<{ htmlFor?: string; className?: string; children?: ReactNode }>

  // Card (from primitives)
  export const Card: FC<{ className?: string; children?: ReactNode }>
  export const CardHeader: FC<{ className?: string; children?: ReactNode }>
  export const CardTitle: FC<{ className?: string; children?: ReactNode }>
  export const CardDescription: FC<{ className?: string; children?: ReactNode }>
  export const CardContent: FC<{ className?: string; children?: ReactNode }>
  export const CardFooter: FC<{ className?: string; children?: ReactNode }>

  // Breadcrumb
  export const Breadcrumb: FC<{ className?: string; children?: ReactNode }>
  export const BreadcrumbList: FC<{ className?: string; children?: ReactNode }>
  export const BreadcrumbItem: FC<{ className?: string; children?: ReactNode }>
  export const BreadcrumbLink: FC<{ className?: string; children?: ReactNode; asChild?: boolean }>
  export const BreadcrumbPage: FC<{ className?: string; children?: ReactNode }>
  export const BreadcrumbSeparator: FC<{ className?: string; children?: ReactNode }>
  export const BreadcrumbEllipsis: FC<{ className?: string }>

  // Popover
  export const Popover: FC<{ children?: ReactNode }>
  export const PopoverTrigger: FC<{ asChild?: boolean; children?: ReactNode }>
  export const PopoverContent: FC<{ className?: string; children?: ReactNode; align?: string; side?: string }>
  export const PopoverAnchor: FC<any>
  export const PopoverClose: FC<any>
}
