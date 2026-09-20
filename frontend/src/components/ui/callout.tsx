import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "cn"

/**
 * A notice inside a page (design-system MASTER.md section 8): a tinted fill, a
 * full 1px edge and a small icon, never a coloured stripe down one side. The
 * blue is the design system's "information" tone (Calendar Blue, the `ring`
 * token). The icon is decoration; the words carry the meaning.
 */
function Callout({
  icon: Icon,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { icon: LucideIcon }) {
  return (
    <div
      data-slot="callout"
      className={cn(
        "flex items-start gap-2 rounded-lg border border-ring/30 bg-ring/5 p-3 text-sm",
        className
      )}
      {...props}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-ring" />
      <div className="flex min-w-0 flex-col gap-1">{children}</div>
    </div>
  )
}

export { Callout }
