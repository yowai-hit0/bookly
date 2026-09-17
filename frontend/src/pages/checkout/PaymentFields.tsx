import type { RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { type PaymentMethod, needsPhoneFor } from '@/catalogue/payments'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Choosing how to pay, and the number to prompt (plan.md Tasks 16 and 18,
 * spec §6.19). One definition, so the booking fee at checkout and the session
 * fee on a client's own booking page offer exactly the same thing.
 *
 * `methods` is the API's answer and nothing else: a method the active provider
 * does not collect is absent from the page, not disabled.
 */

type Props = {
  methods: PaymentMethod[]
  method: PaymentMethod | null
  onMethod: (method: PaymentMethod) => void
  phoneId: string
  phoneRef: RefObject<HTMLInputElement | null>
  phoneInvalid: boolean
}

export function PaymentFields({ methods, method, onMethod, phoneId, phoneRef, phoneInvalid }: Props) {
  const { t } = useTranslation()

  return (
    <>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-lg font-semibold">{t('checkout:methods.legend')}</legend>
        {methods.map((option) => (
          <label
            key={option}
            className="has-checked:border-primary has-focus-visible:ring-ring/50 flex cursor-pointer items-center gap-3 rounded-xl border p-3 has-focus-visible:ring-3"
          >
            <input
              type="radio"
              name="method"
              value={option}
              checked={method === option}
              onChange={() => onMethod(option)}
              className="accent-primary size-4 shrink-0"
            />
            <span>{t(`checkout:methods.${option}`)}</span>
          </label>
        ))}
      </fieldset>

      {needsPhoneFor(method) && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={phoneId}>{t('checkout:phone.label')}</Label>
          <Input
            ref={phoneRef}
            id={phoneId}
            name="phone"
            type="tel"
            autoComplete="tel"
            required
            aria-invalid={phoneInvalid || undefined}
            aria-describedby={[`${phoneId}-hint`, phoneInvalid ? `${phoneId}-error` : null].filter(Boolean).join(' ')}
          />
          <p id={`${phoneId}-hint`} className="text-muted-foreground text-xs">
            {t('checkout:phone.hint')}
          </p>
          {phoneInvalid && (
            <p id={`${phoneId}-error`} className="text-destructive text-xs">
              {t('checkout:phone.invalid')}
            </p>
          )}
        </div>
      )}
    </>
  )
}
