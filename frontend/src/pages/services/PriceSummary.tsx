import { type ReactNode, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { formatMoney } from '@/lib/format'
import { feePercent, quoteBasket } from '@/lib/quote'

/**
 * The running total a visitor watches while choosing (spec §3.1 steps 3 and
 * 7): each chosen line, the total, the booking fee at this service's rate and
 * the session fee left for after the shoot. There is no processing-fee line --
 * the advertised price is what the client pays (A-4b).
 *
 * The amounts are this browser's quote and carry no authority; the API prices
 * the basket again from the catalogue before any money is taken (plan.md
 * Task 11).
 *
 * The non-refundable notice is always shown, whatever is selected. `children`
 * is where a later step toward payment plugs in, and it renders after the
 * notice, so no control leading to payment can be reached before it.
 */

type Line = { id: string; nameEn: string; priceRwf: number }

type Props = {
  /** The chosen package; null until one is chosen. */
  pkg: Line | null
  /** The chosen add-ons, in the order they should be listed. */
  addons: readonly Line[]
  /** This service's booking-fee rate, 0 to 1. */
  bookingFeeRate: number
  children?: ReactNode
}

export function PriceSummary({ pkg, addons, bookingFeeRate, children }: Props) {
  const { t } = useTranslation()
  const headingId = useId()

  const quote =
    pkg === null
      ? null
      : quoteBasket({
          packagePriceRwf: pkg.priceRwf,
          addonPricesRwf: addons.map((addon) => addon.priceRwf),
          bookingFeeRate,
        })

  return (
    <section aria-labelledby={headingId} className="bg-card flex flex-col gap-3 rounded-xl border p-4">
      <h2 id={headingId} className="text-lg font-semibold">
        {t('services:summary.title')}
      </h2>

      <div aria-live="polite">
        {pkg === null || quote === null ? (
          <p className="text-muted-foreground text-sm">{t('services:summary.pickPackage')}</p>
        ) : (
          <dl className="flex flex-col gap-1 text-sm">
            {[pkg, ...addons].map((line) => (
              <div key={line.id} className="flex justify-between gap-4">
                <dt>{line.nameEn}</dt>
                <dd className="shrink-0 tabular-nums">{formatMoney(line.priceRwf)}</dd>
              </div>
            ))}
            <div className="mt-1 flex justify-between gap-4 border-t pt-2 text-base font-semibold">
              <dt>{t('services:summary.total')}</dt>
              <dd className="shrink-0 tabular-nums">{formatMoney(quote.totalRwf)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>{t('services:summary.bookingFee', { percent: feePercent(bookingFeeRate) })}</dt>
              <dd className="shrink-0 font-medium tabular-nums">{formatMoney(quote.bookingFeeRwf)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>{t('services:summary.sessionFee')}</dt>
              <dd className="shrink-0 tabular-nums">{formatMoney(quote.sessionFeeRwf)}</dd>
            </div>
          </dl>
        )}
      </div>

      <p className="text-sm font-medium">{t('services:summary.nonRefundable')}</p>
      {children}
    </section>
  )
}
