import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { kigaliDateOf } from '@/admin/calendar-dates'
import { formatDate, formatTime } from '@/lib/format'

/**
 * What the booking is, in the words the client will recognise: its reference,
 * the service and package, and when. Shared by the pay page and the payment
 * progress page so the two show the same card; `children` are extra rows, such
 * as the pay page's fee, and render inside the same list.
 */

type Props = {
  reference: string
  serviceName: string
  packageName: string
  startsAt: string
  endsAt: string
  children?: ReactNode
}

export function BookingFacts({ reference, serviceName, packageName, startsAt, endsAt, children }: Props) {
  const { t } = useTranslation()

  return (
    <dl className="bg-card flex flex-col gap-2 rounded-xl border p-4 text-sm shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <dt className="text-muted-foreground">{t('checkout:summary.reference')}</dt>
        {/* The reference is what the client keeps, so it is the largest thing in the card. */}
        <dd className="font-mono text-lg font-semibold tracking-wide">{reference}</dd>
      </div>
      <div className="flex flex-wrap justify-between gap-x-4">
        <dt className="text-muted-foreground">{t('checkout:summary.service')}</dt>
        <dd className="min-w-0 wrap-anywhere">
          {t('checkout:summary.serviceValue', { service: serviceName, package: packageName })}
        </dd>
      </div>
      <div className="flex flex-wrap justify-between gap-x-4">
        <dt className="text-muted-foreground">{t('checkout:summary.when')}</dt>
        <dd>
          {t('checkout:summary.whenValue', {
            date: formatDate(kigaliDateOf(startsAt)),
            start: formatTime(startsAt),
            end: formatTime(endsAt),
          })}
        </dd>
      </div>
      {children}
    </dl>
  )
}
