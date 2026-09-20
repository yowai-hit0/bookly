import { Clock, Info } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { kigaliDateOf } from '@/admin/calendar-dates'
import type { HeldBooking } from '@/catalogue/bookings'
import { checkoutPath } from '@/catalogue/payments'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import { formatDate, formatMoney, formatTime } from '@/lib/format'
import { feePercent } from '@/lib/quote'

/**
 * What a visitor sees once their booking holds its slot (plan.md Task 13, spec
 * §3.1 step 8): the reference, what and when, the amounts as the API froze
 * them, and how long the hold lasts. Every amount here is the API's answer --
 * nothing is recomputed in the browser.
 *
 * Paying the booking fee is the next step (spec §3.1 step 9): the checkout
 * link, addressed by the booking's checkout token (plan.md Task 16).
 */

export function BookingHeld({ booking }: { booking: HeldBooking }) {
  const { t } = useTranslation()
  const headingRef = useRef<HTMLHeadingElement>(null)

  // The form the visitor submitted is gone; tell them where they are now.
  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  const fee = formatMoney(booking.bookingFeeRwf)

  return (
    <section className="flex max-w-2xl flex-col gap-4">
      <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-semibold outline-none">
        {t('services:booking.held.title')}
      </h1>

      <dl className="bg-card flex flex-col gap-2 rounded-xl border p-4 text-sm shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4">
          <dt className="text-muted-foreground">{t('services:booking.held.reference')}</dt>
          {/* The reference is what the client keeps, so it is the largest thing in the card. */}
          <dd className="font-mono text-lg font-semibold tracking-wide">{booking.reference}</dd>
        </div>
        <div className="flex flex-wrap justify-between gap-x-4">
          <dt className="text-muted-foreground">{t('services:booking.held.service')}</dt>
          <dd className="min-w-0 wrap-anywhere">
            {t('services:booking.held.serviceValue', { service: booking.serviceName, package: booking.packageName })}
          </dd>
        </div>
        <div className="flex flex-wrap justify-between gap-x-4">
          <dt className="text-muted-foreground">{t('services:booking.held.when')}</dt>
          <dd>
            {t('services:booking.held.whenValue', {
              date: formatDate(kigaliDateOf(booking.startsAt)),
              start: formatTime(booking.startsAt),
              end: formatTime(booking.endsAt),
            })}
          </dd>
        </div>
        <div className="mt-1 flex justify-between gap-4 border-t pt-2">
          <dt className="min-w-0 wrap-anywhere">{booking.packageName}</dt>
          <dd className="shrink-0 tabular-nums">{formatMoney(booking.packagePriceRwf)}</dd>
        </div>
        {booking.addons.map((addon, index) => (
          // Two add-ons may share a name; their order is the booking's own.
          <div key={index} className="flex justify-between gap-4">
            <dt className="min-w-0 wrap-anywhere">{addon.name}</dt>
            <dd className="shrink-0 tabular-nums">{formatMoney(addon.priceRwf)}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-4 border-t pt-2 font-semibold">
          <dt>{t('services:summary.total')}</dt>
          <dd className="shrink-0 tabular-nums">{formatMoney(booking.totalRwf)}</dd>
        </div>
        {/* Due now, so the whole row is a step heavier than the session fee. */}
        <div className="flex justify-between gap-4 font-medium">
          <dt>{t('services:summary.bookingFee', { percent: feePercent(booking.bookingFeeRate) })}</dt>
          <dd className="shrink-0 tabular-nums">{fee}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>{t('services:summary.sessionFee')}</dt>
          <dd className="shrink-0 tabular-nums">{formatMoney(booking.sessionFeeRwf)}</dd>
        </div>
      </dl>

      {/* The hold is time-critical, so it is a callout of its own, above the non-refundable notice. */}
      <Callout icon={Clock}>
        <p>
          {booking.holdExpiresAt === null
            ? t('services:booking.held.holdUntilUnknown', { fee })
            : t('services:booking.held.holdUntil', { time: formatTime(booking.holdExpiresAt), fee })}
        </p>
      </Callout>
      <Callout icon={Info}>
        <p className="font-medium">{t('services:summary.nonRefundable')}</p>
      </Callout>
      {booking.checkoutToken !== undefined && (
        <Button asChild size="lg" className="self-start">
          <Link to={checkoutPath(booking.reference, booking.checkoutToken)}>{t('services:booking.held.pay')}</Link>
        </Button>
      )}
    </section>
  )
}
