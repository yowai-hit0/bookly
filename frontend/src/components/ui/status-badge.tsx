import * as React from "react"
import {
  Archive,
  Ban,
  Camera,
  CheckCheck,
  ClipboardCheck,
  CircleCheck,
  CircleX,
  Clock,
  Hourglass,
  UserX,
  type LucideIcon,
} from "lucide-react"
import { cn } from "cn"
import { Badge } from "./badge"

type Treatment = { icon: LucideIcon | null; className: string }

/**
 * The seven booking statuses, one look for the client's pill and (in a later
 * section) the admin's badges and calendar events (design-system MASTER.md
 * section 7). The label is always shown and the icon only repeats it. The seven
 * stay apart in greyscale: a dashed edge, a dotted edge, a tinted fill, a plain
 * muted fill and no fill, and a different icon each. Tinted fills are mixed into
 * the card's white in oklab, never laid over the page and never mixed in oklch
 * against `--card` (see MASTER section 11). No status uses a heavy red edge; that
 * belongs to the calendar's conflict outline.
 */
const TREATMENTS = new Map<string, Treatment>([
  // An unpaid hold.
  ["pending_payment", { icon: Clock, className: "border-dashed border-muted-foreground bg-transparent text-foreground" }],
  ["confirmed", { icon: CircleCheck, className: "border-primary/30 bg-[color-mix(in_oklab,var(--primary)_10%,var(--card))] text-primary" }],
  ["completed", { icon: CheckCheck, className: "border-transparent bg-muted text-foreground" }],
  ["no_show", { icon: UserX, className: "border-transparent bg-[color-mix(in_oklab,var(--destructive)_10%,var(--card))] text-destructive" }],
  // A hold that lapsed.
  ["expired", { icon: Hourglass, className: "border-dotted border-muted-foreground bg-transparent text-muted-foreground" }],
  ["cancelled_by_client", { icon: CircleX, className: "border-destructive/40 bg-transparent text-destructive" }],
  ["cancelled_by_admin", { icon: Ban, className: "border-input bg-transparent text-muted-foreground" }],
  // The display stages (2026-09-25, `backend/src/booking/stage.ts`): each keeps
  // the rule above -- apart in greyscale by edge, fill and icon.
  // `awaiting_payment` is `pending_payment` under its stage name.
  ["awaiting_payment", { icon: Clock, className: "border-dashed border-muted-foreground bg-transparent text-foreground" }],
  // Happening now: the only solid fill.
  ["in_progress", { icon: Camera, className: "border-transparent bg-primary text-primary-foreground" }],
  // Admin only: the shoot is over and waits on the photographer.
  ["needs_review", { icon: ClipboardCheck, className: "border-ring/40 bg-[color-mix(in_oklab,var(--ring)_10%,var(--card))] text-foreground" }],
  // Photos sent: done, and quieter than completed.
  ["closed", { icon: Archive, className: "border-transparent bg-muted text-muted-foreground" }],
])

/** A status the API adds later still renders, as a plain outline. */
const FALLBACK: Treatment = { icon: null, className: "border-input bg-transparent text-foreground" }

const SIZES = {
  /** The 20px badge, for tables. */
  sm: "",
  /** The header pill on a page: 28px, 14px text and 16px icons. */
  md: "h-7 gap-1.5 px-3 has-data-[icon=inline-start]:pl-2.5 text-sm [&>svg]:size-4!",
} as const

function StatusBadge({
  status,
  size = "sm",
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"span">, "children"> & {
  status: string
  size?: keyof typeof SIZES
  /** The translated label. The client and the admin word some statuses differently. */
  children: React.ReactNode
}) {
  const { icon: Icon, className: treatment } = TREATMENTS.get(status) ?? FALLBACK

  return (
    <Badge
      variant="outline"
      data-status={status}
      className={cn(treatment, SIZES[size], className)}
      {...props}
    >
      {Icon !== null && <Icon aria-hidden="true" data-icon="inline-start" />}
      {children}
    </Badge>
  )
}

export { StatusBadge }
