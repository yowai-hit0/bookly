import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "cn"

const tones = {
  /** Information and waiting: Calendar Blue, the `ring` token. */
  info: { box: "border-ring/30 bg-ring/5", icon: "text-ring" },
  /** A warning about something that cannot be undone. */
  destructive: { box: "border-destructive/30 bg-destructive/5", icon: "text-destructive" },
} as const

/**
 * A notice inside a page (design-system MASTER.md section 8): a tinted fill, a
 * full 1px edge and a small icon, never a coloured stripe down one side. The
 * text stays Ink Navy in every tone; the icon carries the tone, and the words
 * carry the meaning.
 */
function Callout({
  icon: Icon,
  tone = "info",
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { icon: LucideIcon; tone?: keyof typeof tones }) {
  return (
    <div
      data-slot="callout"
      className={cn(
        "flex items-start gap-2 rounded-lg border p-3 text-sm",
        tones[tone].box,
        className
      )}
      {...props}
    >
      <Icon aria-hidden="true" className={cn("mt-0.5 size-4 shrink-0", tones[tone].icon)} />
      <div className="flex min-w-0 flex-col gap-1">{children}</div>
    </div>
  )
}

export { Callout }
