import { type ReactNode, useId } from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/**
 * One labelled control on an admin form: the label above, an optional hint
 * below, and the error below that (plan.md Task 8).
 *
 * The control is a render prop rather than a `kind` switch, because these forms
 * carry inputs, selects and radio groups alike. It hands back the ids and ARIA
 * wiring, so a field can never be labelled or described by hand and get it
 * wrong: the hint and the error are both named by `aria-describedby`, so a
 * screen reader reads the rule and then what is wrong with it.
 */

export type ControlProps = {
  id: string
  'aria-invalid'?: true
  'aria-describedby'?: string
}

type Props = {
  label: string
  hint?: string
  /** The message to show, or null when the field is fine. */
  error?: string | null
  className?: string
  children: (props: ControlProps) => ReactNode
}

export function AdminField({ label, hint, error = null, className, children }: Props) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint === undefined ? null : hintId, error === null ? null : errorId].filter(Boolean).join(' ')

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      {children({
        id,
        ...(error === null ? {} : { 'aria-invalid': true as const }),
        ...(describedBy === '' ? {} : { 'aria-describedby': describedBy }),
      })}
      {hint !== undefined && (
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      )}
      {error !== null && (
        <p id={errorId} className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  )
}

/** A native select styled like `Input`, so the admin forms have one look. */
export const SELECT_CLASS =
  'h-8 pointer-coarse:h-11 w-full min-w-0 rounded-lg border border-input bg-card px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm'
