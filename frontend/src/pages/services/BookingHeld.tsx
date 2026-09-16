import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { kigaliDateOf } from '@/admin/calendar-dates'
import type { HeldBooking } from '@/catalogue/bookings'
import { formatDate, formatMoney, formatTime } from '@/lib/format'
import { feePercent } from '@/lib/quote'

/**
 * What a visitor sees once their booking holds its slot (plan.md Task 13, spec
 * §3.1 step 8): the reference, what and when, the amounts as the API froze
 * them, and how long the hold lasts. Every amount here is the API's answer --
 * nothing is recomputed in the browser.
 *
 * Paying the booking fee is the next step (spec §3.1 step 9); the payment
 * control arrives with the payment adapter (plan.md Task 16).
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

      <dl className="bg-card flex flex-col gap-2 rounded-xl border p-4 text-sm">
        <div className="flex flex-wrap justify-between gap-x-4">
          <dt className="text-muted-foreground">{t('services:booking.held.reference')}</dt>
          <dd className="font-mono text-base font-semibold tracking-wide">{booking.reference}</dd>
        </div>
        <div className="flex flex-wrap justify-between gap-x-4">
          <dt className="text-muted-foreground">{t('services:booking.held.service')}</dt>
          <dd>{t('services:booking.held.serviceValue', { service: booking.serviceName, package: booking.packageName })}</dd>
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
          <dt>{booking.packageName}</dt>
          <dd className="tabular-nums">{formatMoney(booking.packagePriceRwf)}</dd>
        </div>
        {booking.addons.map((addon, index) => (
          // Two add-ons may share a name; their order is the booking's own.
          <div key={index} className="flex justify-between gap-4">
            <dt>{addon.name}</dt>
            <dd className="tabular-nums">{formatMoney(addon.priceRwf)}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-4 border-t pt-2 font-semibold">
          <dt>{t('services:summary.total')}</dt>
          <dd className="tabular-nums">{formatMoney(booking.totalRwf)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>{t('services:summary.bookingFee', { percent: feePercent(booking.bookingFeeRate) })}</dt>
          <dd className="font-medium tabular-nums">{fee}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>{t('services:summary.sessionFee')}</dt>
          <dd className="tabular-nums">{formatMoney(booking.sessionFeeRwf)}</dd>
        </div>
      </dl>

      <p className="text-sm">
        {booking.holdExpiresAt === null
          ? t('services:booking.held.holdUntilUnknown', { fee })
          : t('services:booking.held.holdUntil', { time: formatTime(booking.holdExpiresAt), fee })}
      </p>
      <p className="text-sm font-medium">{t('services:summary.nonRefundable')}</p>
    </section>
  )
}
