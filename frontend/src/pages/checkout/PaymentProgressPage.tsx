import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { kigaliDateOf } from '@/admin/calendar-dates'
import { bookingPath } from '@/catalogue/booking-access'
import { type PaymentProgress, checkoutPath, fetchPaymentProgress } from '@/catalogue/payments'
import { Button } from '@/components/ui/button'
import { formatDate, formatMoney, formatTime } from '@/lib/format'

/**
 * The confirmation page (plan.md Task 16, spec §3.1 step 10): where a started
 * payment is followed until the provider settles it.
 *
 * Mobile Money routinely takes 30 seconds or more, so this page is the whole
 * experience of the wait. It shows the booking as pending and polls the API; it
 * says "confirmed" only once the API reports the payment succeeded -- which
 * happens only when the provider's verified webhook has been applied (Task 17)
 * -- and never on a timer, a redirect or a guess. It says the wait can take a
 * minute and that the confirmation email comes anyway if the page is closed.
 */

export const POLL_INTERVAL_MS = 3_000
/** Past this the page stops asking on its own; the visitor can ask again. */
export const POLL_GIVE_UP_MS = 10 * 60_000
/** Consecutive failed checks before the page admits it cannot check. */
const TROUBLE_AFTER_FAILURES = 3

type View = 'waiting' | 'confirmed' | 'received' | 'failed' | 'refund' | 'duplicate' | 'refundOther'

function viewOf(progress: PaymentProgress): View {
  const { payment, booking } = progress
  switch (payment.status) {
    case 'initiated':
    case 'pending':
      return 'waiting'
    case 'succeeded':
      return booking.status === 'pending_payment' || booking.status === 'expired' ? 'received' : 'confirmed'
    case 'failed':
      return 'failed'
    case 'refund_due':
    case 'refunded':
      // Owed back because the slot went, because the booking was already paid,
      // or because the booking has since been cancelled.
      if (booking.status === 'expired') return 'refund'
      if (booking.status === 'confirmed' || booking.status === 'completed' || booking.status === 'no_show') return 'duplicate'
      return 'refundOther'
    default:
      return 'waiting'
  }
}

export function PaymentProgressPage() {
  const { t } = useTranslation()
  const { reference = '', token = '', ourRef = '' } = useParams()
  /** Tagged with the payment it describes, so another payment's answer is never shown as this one's. */
  const [answer, setAnswer] = useState<{ ourRef: string; progress: PaymentProgress | null } | null>(null)
  const [failures, setFailures] = useState(0)
  const [gaveUp, setGaveUp] = useState(false)
  const [round, setRound] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    const startedAt = Date.now()
    let timer: ReturnType<typeof setTimeout> | undefined

    const poll = async () => {
      try {
        const next = await fetchPaymentProgress(ourRef, controller.signal)
        if (controller.signal.aborted) return
        setAnswer({ ourRef, progress: next })
        setFailures(0)
        if (next === null) return
        if (viewOf(next) !== 'waiting') return
      } catch {
        if (controller.signal.aborted) return
        setFailures((n) => n + 1)
      }
      if (Date.now() - startedAt >= POLL_GIVE_UP_MS) {
        setGaveUp(true)
        return
      }
      timer = setTimeout(() => void poll(), POLL_INTERVAL_MS)
    }
    void poll()

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [ourRef, round])

  const current = answer?.ourRef === ourRef ? answer : null
  const missing = current !== null && current.progress === null
  const progress = current?.progress ?? null
  const view: View | null = progress === null ? null : viewOf(progress)
  const headingRef = useRef<HTMLHeadingElement>(null)
  // Each change of outcome is news: move focus to what it says.
  useEffect(() => {
    if (view !== null && view !== 'waiting') headingRef.current?.focus()
  }, [view])

  function checkAgain() {
    setGaveUp(false)
    setRound((n) => n + 1)
  }

  if (missing) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-3 px-4 py-8">
        <h1 className="text-2xl font-semibold">{t('checkout:invalidLink.title')}</h1>
        <p className="text-muted-foreground text-sm">{t('checkout:invalidLink.body')}</p>
      </main>
    )
  }

  if (progress === null || view === null) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col items-start gap-3 px-4 py-8">
        {gaveUp ? (
          // Stopped: say so, and offer to start again, rather than promise retries.
          <>
            <p className="text-sm" role="status">
              {t('checkout:progress.couldNotCheck')}
            </p>
            <Button variant="outline" size="sm" onClick={checkAgain}>
              {t('checkout:progress.checkAgain')}
            </Button>
          </>
        ) : (
          <p className="text-muted-foreground text-sm" role="status">
            {failures >= TROUBLE_AFTER_FAILURES ? t('checkout:progress.connectionTrouble') : t('checkout:loading')}
          </p>
        )}
      </main>
    )
  }

  const amount = formatMoney(progress.payment.amountRwf)
  const { booking } = progress
  // The booking fee is paid from a checkout link, the session fee from the
  // client's own booking page: another attempt belongs where this one started.
  const payAgainAt = reference === '' ? bookingPath(token) : checkoutPath(reference, token)

  const heading = (key: string) => (
    <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold outline-none">
      {t(key)}
    </h1>
  )

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-8">
      {view === 'waiting' && (
        <section className="flex flex-col gap-3" role="status" aria-live="polite">
          {heading('checkout:progress.pendingTitle')}
          <p className="text-sm">{t('checkout:progress.pendingBody', { amount })}</p>
          <p className="text-sm">{t('checkout:progress.pendingWait')}</p>
          <p className="text-muted-foreground text-sm">{t('checkout:progress.pendingLeave')}</p>
          {failures >= TROUBLE_AFTER_FAILURES && !gaveUp && (
            <p className="text-muted-foreground text-sm">{t('checkout:progress.connectionTrouble')}</p>
          )}
        </section>
      )}
      {view === 'waiting' && gaveUp && (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm">{t('checkout:progress.stillWaiting')}</p>
          <Button variant="outline" size="sm" onClick={checkAgain}>
            {t('checkout:progress.checkAgain')}
          </Button>
        </div>
      )}

      {view === 'confirmed' && (
        <section className="flex flex-col gap-3">
          {heading('checkout:progress.confirmedTitle')}
          <p className="text-sm">{t('checkout:progress.confirmedBody')}</p>
        </section>
      )}
      {view === 'received' && (
        <section className="flex flex-col gap-3">
          {heading('checkout:progress.receivedTitle')}
          <p className="text-sm">{t('checkout:progress.receivedBody', { amount })}</p>
        </section>
      )}
      {view === 'failed' && (
        <section className="flex flex-col gap-3">
          {heading('checkout:progress.failedTitle')}
          <p className="text-sm">
            {progress.payment.failure === 'unavailable'
              ? t('checkout:progress.failedUnavailable')
              : t('checkout:progress.failedDeclined')}
          </p>
          <Button asChild className="self-start">
            <Link to={payAgainAt}>{t('checkout:progress.tryAgain')}</Link>
          </Button>
        </section>
      )}
      {view === 'refund' && (
        <section className="flex flex-col gap-3">
          {heading('checkout:progress.refundTitle')}
          <p className="text-sm">{t('checkout:progress.refundBody', { amount })}</p>
        </section>
      )}
      {view === 'refundOther' && (
        <section className="flex flex-col gap-3">
          {heading('checkout:progress.refundOtherTitle')}
          <p className="text-sm">{t('checkout:progress.refundOtherBody', { amount })}</p>
        </section>
      )}
      {view === 'duplicate' && (
        <section className="flex flex-col gap-3">
          {heading('checkout:progress.duplicateTitle')}
          <p className="text-sm">{t('checkout:progress.duplicateBody', { amount })}</p>
        </section>
      )}

      <dl className="bg-card flex flex-col gap-2 rounded-xl border p-4 text-sm">
        <div className="flex flex-wrap justify-between gap-x-4">
          <dt className="text-muted-foreground">{t('checkout:summary.reference')}</dt>
          <dd className="font-mono text-base font-semibold tracking-wide">{booking.reference}</dd>
        </div>
        <div className="flex flex-wrap justify-between gap-x-4">
          <dt className="text-muted-foreground">{t('checkout:summary.service')}</dt>
          <dd>{t('checkout:summary.serviceValue', { service: booking.serviceName, package: booking.packageName })}</dd>
        </div>
        <div className="flex flex-wrap justify-between gap-x-4">
          <dt className="text-muted-foreground">{t('checkout:summary.when')}</dt>
          <dd>
            {t('checkout:summary.whenValue', {
              date: formatDate(kigaliDateOf(booking.startsAt)),
              start: formatTime(booking.startsAt),
              end: formatTime(booking.endsAt),
            })}
          </dd>
        </div>
      </dl>
    </main>
  )
}
