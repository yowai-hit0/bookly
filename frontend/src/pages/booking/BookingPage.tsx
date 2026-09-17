import { type FormEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { kigaliDateOf } from '@/admin/calendar-dates'
import {
  type ClientBooking,
  bookingPaymentPath,
  cancelBooking,
  fetchClientBooking,
  startSessionFeePayment,
} from '@/catalogue/booking-access'
import { isPlausiblePhone } from '@/catalogue/bookings'
import { type PaymentMethod, fetchPaymentMethods, needsPhoneFor } from '@/catalogue/payments'
import { Button } from '@/components/ui/button'
import { formatDate, formatMoney, formatTime } from '@/lib/format'
import { reportError } from '@/lib/report-error'
import { PaymentFields } from '@/pages/checkout/PaymentFields'

/**
 * A client's own booking (plan.md Task 18; spec §3.9, §6.10): where they check
 * what they booked and what it cost, pay what is still owed, open their photos,
 * and cancel.
 *
 * The access token in the path is the whole of their identity, so the page
 * sends nothing else -- no reference, no id -- and an invalid, expired or
 * replaced token gets the same "link is not valid" page as one that never
 * existed. Every amount is the API's; nothing here adds anything up.
 */

type Loaded =
  | { status: 'ok'; booking: ClientBooking; methods: PaymentMethod[] }
  | { status: 'missing' }
  | { status: 'failed' }

export function BookingPage() {
  const { t } = useTranslation()
  const { token = '' } = useParams()
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState<(Loaded & { key: string }) | null>(null)
  const key = `${token}:${attempt}`

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([fetchClientBooking(token, controller.signal), fetchPaymentMethods(controller.signal).catch(() => [])])
      .then(([booking, methods]) => {
        if (controller.signal.aborted) return
        setLoaded(booking === null ? { key, status: 'missing' } : { key, status: 'ok', booking, methods })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        reportError(error, 'client_booking_load_failed')
        setLoaded({ key, status: 'failed' })
      })
    return () => controller.abort()
  }, [token, key])

  function reload() {
    setLoaded(null)
    setAttempt((n) => n + 1)
  }

  const current = loaded?.key === key ? loaded : null

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      {current === null && (
        <p className="text-muted-foreground text-sm" role="status">
          {t('booking:loading')}
        </p>
      )}
      {current?.status === 'failed' && (
        <div className="flex flex-wrap items-center gap-2" role="alert">
          <p className="text-destructive text-sm">{t('booking:loadFailed')}</p>
          <Button variant="outline" size="sm" onClick={reload}>
            {t('booking:retry')}
          </Button>
        </div>
      )}
      {current?.status === 'missing' && <InvalidLink />}
      {current?.status === 'ok' && (
        <BookingView
          key={attempt}
          token={token}
          booking={current.booking}
          methods={current.methods}
          onMissing={() => setLoaded({ key, status: 'missing' })}
          onReload={reload}
        />
      )}
    </main>
  )
}

function InvalidLink() {
  const { t } = useTranslation()
  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-2xl font-semibold">{t('booking:invalidLink.title')}</h1>
      <p className="text-muted-foreground text-sm">{t('booking:invalidLink.body')}</p>
    </section>
  )
}

type ViewProps = {
  token: string
  booking: ClientBooking
  methods: PaymentMethod[]
  onMissing: () => void
  onReload: () => void
}

function BookingView({ token, booking: loadedBooking, methods, onMissing, onReload }: ViewProps) {
  const { t } = useTranslation()
  const [booking, setBooking] = useState(loadedBooking)
  // Lives here, not in the cancel section: a refusal usually arrives with a
  // booking that can no longer be cancelled, which takes that section away.
  const [refused, setRefused] = useState(false)

  return (
    <>
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-3xl font-semibold">{t('booking:title')}</h1>
          <p className="bg-muted rounded-full px-3 py-1 text-sm font-medium">{t(`booking:status.${booking.status}`)}</p>
        </div>

        <dl className="bg-card flex flex-col gap-2 rounded-xl border p-4 text-sm">
          <Line term={t('booking:labels.reference')}>
            <span className="font-mono text-base font-semibold tracking-wide">{booking.reference}</span>
          </Line>
          <Line term={t('booking:labels.service')}>
            {t('booking:serviceValue', { service: booking.serviceName, package: booking.packageName })}
          </Line>
          <Line term={t('booking:labels.when')}>
            {t('booking:whenValue', {
              date: formatDate(kigaliDateOf(booking.startsAt)),
              start: formatTime(booking.startsAt),
              end: formatTime(booking.endsAt),
            })}
          </Line>
          <Line term={t('booking:labels.location')}>{booking.locationText}</Line>
          {booking.partySize !== null && <Line term={t('booking:labels.people')}>{booking.partySize}</Line>}
          <Line term={t('booking:labels.photos')}>{t('booking:photos', { count: booking.packagePhotoCount })}</Line>
          {booking.specialRequests !== null && (
            <Line term={t('booking:labels.requests')}>
              <span className="whitespace-pre-line">{booking.specialRequests}</span>
            </Line>
          )}
        </dl>

        <Amounts booking={booking} />
      </section>

      {booking.delivery !== null && <Delivery delivery={booking.delivery} />}

      {booking.sessionFee !== null && (
        <SessionFee
          token={token}
          booking={booking}
          methods={methods}
          onMissing={onMissing}
          onReload={onReload}
        />
      )}

      {booking.canCancel && (
        <Cancel
          token={token}
          booking={booking}
          onCancelled={setBooking}
          onRefused={() => setRefused(true)}
          onMissing={onMissing}
        />
      )}

      {refused && (
        <p className="text-destructive text-sm" role="alert">
          {t('booking:cancel.notCancellable')}
        </p>
      )}

      {booking.cancelledAt !== null && (
        <section className="flex flex-col gap-2 rounded-xl border p-4">
          <h2 className="text-lg font-semibold">{t('booking:cancelled.title')}</h2>
          {booking.cancellationReason !== null && <p className="text-sm">{booking.cancellationReason}</p>}
          {booking.totals.refundDueRwf > 0 && (
            <p className="text-sm">{t('booking:cancelled.refund', { amount: formatMoney(booking.totals.refundDueRwf) })}</p>
          )}
        </section>
      )}
    </>
  )
}

/** Every amount as the API computed it (data-model_v2.md §6.1): nothing is added up here. */
function Amounts({ booking }: { booking: ClientBooking }) {
  const { t } = useTranslation()
  return (
    <dl className="bg-card flex flex-col gap-2 rounded-xl border p-4 text-sm">
      <div className="flex justify-between gap-4">
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
        <dt>{t('booking:labels.total')}</dt>
        <dd className="tabular-nums">{formatMoney(booking.totals.grandTotalRwf)}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt>{t('booking:labels.paid')}</dt>
        <dd className="tabular-nums">{formatMoney(booking.totals.collectedRwf)}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt>{t('booking:labels.outstanding')}</dt>
        <dd className="font-medium tabular-nums">{formatMoney(booking.totals.outstandingRwf)}</dd>
      </div>
      {booking.totals.refundDueRwf > 0 && (
        <div className="flex justify-between gap-4">
          <dt>{t('booking:labels.refundDue')}</dt>
          <dd className="tabular-nums">{formatMoney(booking.totals.refundDueRwf)}</dd>
        </div>
      )}
    </dl>
  )
}

function Delivery({ delivery }: { delivery: NonNullable<ClientBooking['delivery']> }) {
  const { t } = useTranslation()
  return (
    <section className="flex flex-col gap-2 rounded-xl border p-4">
      <h2 className="text-lg font-semibold">{t('booking:delivery.title')}</h2>
      {delivery.note !== null && <p className="text-sm">{delivery.note}</p>}
      {delivery.expired || delivery.url === null ? (
        <p className="text-sm">{t('booking:delivery.expired')}</p>
      ) : (
        <>
          <Button asChild className="self-start">
            <a href={delivery.url} rel="noreferrer noopener" target="_blank">
              {t('booking:delivery.open')}
            </a>
          </Button>
          {delivery.expiresOn !== null && (
            <p className="text-muted-foreground text-sm">
              {t('booking:delivery.expires', { date: formatDate(delivery.expiresOn) })}
            </p>
          )}
        </>
      )}
    </section>
  )
}

type SessionFeeProps = {
  token: string
  booking: ClientBooking
  methods: PaymentMethod[]
  onMissing: () => void
  onReload: () => void
}

/** The payment control, shown only while something is outstanding (plan.md Task 18). */
function SessionFee({ token, booking, methods, onMissing, onReload }: SessionFeeProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const idPrefix = useId()
  const [method, setMethod] = useState<PaymentMethod | null>(methods[0] ?? null)
  const [phoneInvalid, setPhoneInvalid] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<'rejected' | 'unavailable' | 'failed' | null>(null)
  const phoneRef = useRef<HTMLInputElement>(null)
  const fee = booking.sessionFee === null ? 0 : booking.sessionFee.outstandingRwf
  const amount = formatMoney(fee)
  const phoneId = `${idPrefix}phone`
  const waiting = booking.sessionFee?.waitingPayment ?? null

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting || method === null) return
    setError(null)

    const phone = String(new FormData(event.currentTarget).get('phone') ?? '').trim()
    const needsPhone = needsPhoneFor(method)
    if (needsPhone && !isPlausiblePhone(phone)) {
      setPhoneInvalid(true)
      phoneRef.current?.focus()
      return
    }
    setPhoneInvalid(false)

    setSubmitting(true)
    const result = await startSessionFeePayment(token, { method, phone: needsPhone ? phone : '' })
    setSubmitting(false)

    switch (result.status) {
      case 'started':
      case 'in_progress':
        void navigate(bookingPaymentPath(token, result.ourRef))
        return
      case 'not_found':
        onMissing()
        return
      case 'already_paid':
      case 'closed':
        onReload()
        return
      case 'invalid':
        // Only a field on screen can be marked; anything else must still be said.
        if (needsPhone && result.fields.includes('phone')) {
          setPhoneInvalid(true)
          phoneRef.current?.focus()
        } else {
          setError('failed')
        }
        return
      case 'not_started':
        setError(result.reason)
        return
      case 'failed':
        setError('failed')
        return
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{t('booking:sessionFee.title')}</h2>
        <p className="text-sm">{t('booking:sessionFee.intro', { amount })}</p>
      </div>

      {waiting !== null && (
        <p className="bg-muted rounded-lg p-3 text-sm">
          {t('checkout:waiting.text')}{' '}
          <Link to={bookingPaymentPath(token, waiting.ourRef)} className="text-primary underline-offset-4 hover:underline">
            {t('checkout:waiting.link')}
          </Link>
        </p>
      )}

      {methods.length === 0 ? (
        <p className="text-destructive text-sm" role="alert">
          {t('checkout:errors.noMethods')}
        </p>
      ) : (
        <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
          <PaymentFields
            methods={methods}
            method={method}
            onMethod={setMethod}
            phoneId={phoneId}
            phoneRef={phoneRef}
            phoneInvalid={phoneInvalid}
          />
          <Button
            type="submit"
            className="w-full sm:w-auto sm:self-start"
            // Not `disabled`: that would drop keyboard focus mid-submit.
            aria-disabled={submitting}
            aria-busy={submitting}
          >
            {submitting ? t('checkout:paying') : t('booking:sessionFee.pay', { amount })}
          </Button>
          {error !== null && (
            <p className="text-destructive text-sm" role="alert">
              {t(`checkout:errors.${error}`)}
            </p>
          )}
        </form>
      )}
    </section>
  )
}

type CancelProps = {
  token: string
  booking: ClientBooking
  onCancelled: (booking: ClientBooking) => void
  /** The API refused: said above this section, which the refusal may remove. */
  onRefused: () => void
  onMissing: () => void
}

/**
 * Cancelling, in two steps: the warning that the booking fee is not refunded
 * (spec §6.10) stands between the button and the request, and says the amount.
 */
function Cancel({ token, booking, onCancelled, onRefused, onMissing }: CancelProps) {
  const { t } = useTranslation()
  const [confirming, setConfirming] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState<'failed' | null>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (confirming) confirmRef.current?.focus()
  }, [confirming])

  async function cancel() {
    if (cancelling) return
    setError(null)
    setCancelling(true)
    const result = await cancelBooking(token)
    setCancelling(false)

    if (result.status === 'cancelled') {
      onCancelled(result.booking)
      return
    }
    if (result.status === 'not_found') {
      onMissing()
      return
    }
    if (result.status === 'not_cancellable') {
      onRefused()
      if (result.booking !== null) onCancelled(result.booking)
      return
    }
    setError('failed')
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border p-4">
      <h2 className="text-lg font-semibold">{t('booking:cancel.title')}</h2>
      {confirming ? (
        <>
          <p className="text-sm font-medium">{t('booking:cancel.warning', { fee: formatMoney(booking.bookingFeeRwf) })}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              ref={confirmRef}
              variant="destructive"
              onClick={() => void cancel()}
              aria-disabled={cancelling}
              aria-busy={cancelling}
            >
              {cancelling ? t('booking:cancel.cancelling') : t('booking:cancel.confirm')}
            </Button>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              {t('booking:cancel.keep')}
            </Button>
          </div>
        </>
      ) : (
        <Button variant="outline" className="self-start" onClick={() => setConfirming(true)}>
          {t('booking:cancel.start')}
        </Button>
      )}
      {error !== null && (
        <p className="text-destructive text-sm" role="alert">
          {t(`booking:cancel.${error}`)}
        </p>
      )}
    </section>
  )
}

function Line({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-4">
      <dt className="text-muted-foreground">{term}</dt>
      <dd>{children}</dd>
    </div>
  )
}
