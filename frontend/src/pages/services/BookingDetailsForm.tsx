import { type FormEvent, useId } from 'react'
import { useTranslation } from 'react-i18next'
import type { DetailField } from '@/catalogue/bookings'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { stepNumber } from './step-number'

/**
 * The booking form (plan.md Task 13, spec §3.1 step 6): name, email, phone,
 * location, number of people, special requests and consent.
 *
 * Inputs are uncontrolled and the form stays mounted while a package is chosen,
 * so what the visitor typed survives a slot being taken and chosen again. The
 * submit control lives in the price summary, after the non-refundable notice
 * (plan.md Task 11), and reaches this form through its `form` attribute.
 */

type Props = {
  id: string
  /** Fields to mark wrong: the form's own check, or the API's 422. */
  invalid: ReadonlySet<DetailField>
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

type TextField = {
  name: Exclude<DetailField, 'consent'>
  type?: 'email' | 'tel'
  autoComplete?: string
  inputMode?: 'numeric'
  multiline?: boolean
  hint?: boolean
  /** Announced as required; `noValidate` keeps the browser's own bubbles away. */
  required?: boolean
}

const TEXT_FIELDS: readonly TextField[] = [
  { name: 'fullName', autoComplete: 'name', required: true },
  { name: 'email', type: 'email', autoComplete: 'email', required: true },
  { name: 'phone', type: 'tel', autoComplete: 'tel', hint: true, required: true },
  { name: 'location', required: true },
  { name: 'partySize', inputMode: 'numeric', hint: true },
  { name: 'specialRequests', multiline: true, hint: true },
]

export function BookingDetailsForm({ id, invalid, onSubmit }: Props) {
  const { t } = useTranslation()
  const idPrefix = useId()
  const headingId = `${idPrefix}heading`

  return (
    <form id={id} noValidate onSubmit={onSubmit} aria-labelledby={headingId} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id={headingId} className={cn('text-lg font-semibold', stepNumber)}>
          {t('services:booking.title')}
        </h2>
        <p className="text-muted-foreground text-sm">{t('services:booking.intro')}</p>
      </div>

      {TEXT_FIELDS.map((field) => {
        const inputId = `${idPrefix}${field.name}`
        const isInvalid = invalid.has(field.name)
        const describedBy = [field.hint ? `${inputId}-hint` : null, isInvalid ? `${inputId}-error` : null]
          .filter(Boolean)
          .join(' ')
        const common = {
          id: inputId,
          name: field.name,
          required: field.required,
          'aria-invalid': isInvalid || undefined,
          'aria-describedby': describedBy || undefined,
        }
        return (
          <div key={field.name} className="flex flex-col gap-1.5">
            <Label htmlFor={inputId}>{t(`services:booking.fields.${field.name}`)}</Label>
            {field.multiline ? (
              <Textarea {...common} rows={3} />
            ) : (
              <Input {...common} type={field.type ?? 'text'} autoComplete={field.autoComplete} inputMode={field.inputMode} />
            )}
            {field.hint && (
              <p id={`${inputId}-hint`} className="text-muted-foreground text-sm">
                {t(`services:booking.hints.${field.name}`)}
              </p>
            )}
            {isInvalid && (
              <p id={`${inputId}-error`} className="text-destructive text-sm">
                {t(`services:booking.invalid.${field.name}`)}
              </p>
            )}
          </div>
        )
      })}

      <div className="flex flex-col gap-1.5">
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="consent"
            required
            aria-invalid={invalid.has('consent') || undefined}
            aria-describedby={invalid.has('consent') ? `${idPrefix}consent-error` : undefined}
            className="accent-primary focus-visible:outline-ring mt-0.5 size-4 shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2"
          />
          <span>{t('services:booking.consent')}</span>
        </label>
        {invalid.has('consent') && (
          <p id={`${idPrefix}consent-error`} className="text-destructive text-sm">
            {t('services:booking.invalid.consent')}
          </p>
        )}
      </div>
    </form>
  )
}
