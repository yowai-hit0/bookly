import { type FormEvent, type ReactNode, useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { ApiError, UnauthenticatedError } from '@/admin/api'
import { type AdminBooking, type AdminPayment, bookingsApi } from '@/admin/bookings'
import { kigaliDateOf } from '@/admin/calendar-dates'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatDate, formatDateTime, formatMoney, formatTime } from '@/lib/format'

/**
 * One booking, and everything the photographer does to it (plan.md Task 19;
 * spec §3.6, §6.11, §6.12, §6.16, §6.21).
 *
 * Every action answers with the booking as it now stands, and so does every
 * refusal: a slot taken while he was choosing, or a booking cancelled in
 * another tab, replaces what is on screen instead of leaving him to guess. The
 * buttons follow the API's own `actions` flags, which the API enforces again.
 */

/** Kigali is UTC+2 with no DST (spec §6.5), so a fixed offset is exact. */
const KIGALI_OFFSET = '+02:00'

type Failure = { code: string } | null

export function AdminBookingDetail() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id = '' } = useParams()
  const [booking, setBooking] = useState<AdminBooking | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'failed'>('loading')
  const [failure, setFailure] = useState<Failure>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    bookingsApi
      .get(id)
      .then((answer) => {
        if (cancelled) return
        setBooking(answer.booking)
        setState('ready')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        if (error instanceof UnauthenticatedError) {
          void navigate('/admin/login', { replace: true })
          return
        }
        setState(error instanceof ApiError && error.status === 404 ? 'missing' : 'failed')
      })
    return () => {
      cancelled = true
    }
  }, [id, navigate])

  /** Runs an action, then shows whatever the API says the booking now is. */
  async function act(action: () => Promise<{ booking: AdminBooking }>): Promise<void> {
    if (busy) return
    setBusy(true)
    setFailure(null)
    try {
      setBooking((await action()).booking)
    } catch (error) {
      if (error instanceof UnauthenticatedError) {
        void navigate('/admin/login', { replace: true })
        return
      }
      setFailure({ code: error instanceof ApiError ? error.message : 'failed' })
      // A refusal carries the booking it refused; re-reading it is how the
      // screen catches up with whatever changed underneath.
      if (error instanceof ApiError && error.status === 409) {
        const fresh = await bookingsApi.get(id).catch(() => null)
        if (fresh !== null) setBooking(fresh.booking)
      }
    } finally {
      setBusy(false)
    }
  }

  if (state === 'loading') {
    return (
      <Shell>
        <p className="text-muted-foreground text-sm" role="status">
          {t('admin:booking.loading')}
        </p>
      </Shell>
    )
  }
  if (state === 'missing' || booking === null) {
    return (
      <Shell>
        <h1 className="text-2xl font-semibold">{t('admin:booking.missing')}</h1>
      </Shell>
    )
  }
  if (state === 'failed') {
    return (
      <Shell>
        <p className="text-destructive text-sm" role="alert">
          {t('admin:booking.loadFailed')}
        </p>
      </Shell>
    )
  }

  const { schedule, money, actions } = booking

  return (
    <Shell>
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-mono text-2xl font-semibold">{booking.reference}</h1>
        <Badge variant="outline">{t(`admin:bookings.status.${booking.status}`)}</Badge>
      </header>

      {failure !== null && (
        <p className="text-destructive text-sm" role="alert">
          {t(`admin:booking.errors.${failure.code}`, { defaultValue: t('admin:booking.errors.failed') })}
        </p>
      )}

      <Section title={t('admin:booking.sections.shoot')}>
        <Line term={t('admin:booking.labels.when')}>
          {formatDate(kigaliDateOf(schedule.startsAt))}, {formatTime(schedule.startsAt)} – {formatTime(schedule.endsAt)}
        </Line>
        <Line term={t('admin:booking.labels.service')}>
          {booking.service.name}, {booking.package.name}
        </Line>
        <Line term={t('admin:booking.labels.location')}>{booking.details.locationText}</Line>
        {booking.details.partySize !== null && <Line term={t('admin:booking.labels.people')}>{booking.details.partySize}</Line>}
        {booking.details.specialRequests !== null && (
          <Line term={t('admin:booking.labels.requests')}>
            <span className="whitespace-pre-line">{booking.details.specialRequests}</span>
          </Line>
        )}
        {schedule.originalStartsAt !== null && (
          <Line term={t('admin:booking.labels.originally')}>{formatDateTime(schedule.originalStartsAt)}</Line>
        )}
        {schedule.rescheduledAt !== null && <Line term={t('admin:booking.labels.movedAt')}>{formatDateTime(schedule.rescheduledAt)}</Line>}
        {booking.lifecycle.cancellationReason !== null && (
          <Line term={t('admin:booking.labels.cancellationReason')}>{booking.lifecycle.cancellationReason}</Line>
        )}
      </Section>

      <Section title={t('admin:booking.sections.client')}>
        <Line term={t('admin:booking.labels.name')}>{booking.contact.name}</Line>
        <Line term={t('admin:booking.labels.email')}>{booking.contact.email}</Line>
        <Line term={t('admin:booking.labels.phone')}>{booking.contact.phone}</Line>
        <Line term={t('admin:booking.labels.link')}>
          {booking.access.hasLink
            ? t('admin:booking.linkLive', { date: formatDateTime(booking.access.expiresAt ?? schedule.startsAt) })
            : t('admin:booking.linkNone')}
        </Line>
      </Section>

      <Section title={t('admin:booking.sections.money')}>
        <Line term={booking.package.name}>{formatMoney(booking.package.priceRwf)}</Line>
        {booking.addons.map((addon) => (
          <Line key={addon.id} term={`${addon.name}${addon.stage === 'post_shoot' ? ` (${t('admin:booking.postShoot')})` : ''}`}>
            {formatMoney(addon.amountRwf)}
          </Line>
        ))}
        <Line term={t('admin:booking.labels.total')}>{formatMoney(money.totals.grandTotalRwf)}</Line>
        <Line term={t('admin:booking.labels.collected')}>{formatMoney(money.totals.collectedRwf)}</Line>
        <Line term={t('admin:booking.labels.outstanding')}>{formatMoney(money.totals.outstandingRwf)}</Line>
        {money.totals.refundDueRwf > 0 && (
          <Line term={t('admin:booking.labels.refundDue')}>{formatMoney(money.totals.refundDueRwf)}</Line>
        )}
      </Section>

      <Payments booking={booking} busy={busy} onRefund={(paymentId, reference) => act(() => bookingsApi.recordRefund(paymentId, reference))} />

      <Section title={t('admin:booking.sections.actions')}>
        <div className="flex flex-col gap-4">
          {actions.canReschedule && <RescheduleForm booking={booking} busy={busy} onSubmit={(startsAt) => act(() => bookingsApi.reschedule(booking.id, startsAt))} />}
          {actions.canCancel && <CancelForm busy={busy} onSubmit={(reason) => act(() => bookingsApi.cancel(booking.id, reason))} />}
          <div className="flex flex-wrap gap-2">
            {actions.canComplete && (
              <Button variant="outline" aria-disabled={busy} onClick={() => void act(() => bookingsApi.complete(booking.id))}>
                {t('admin:booking.complete')}
              </Button>
            )}
            {actions.canMarkNoShow && (
              <Button variant="outline" aria-disabled={busy} onClick={() => void act(() => bookingsApi.markNoShow(booking.id))}>
                {t('admin:booking.noShow')}
              </Button>
            )}
            {actions.canResendLink && (
              <Button variant="outline" aria-disabled={busy} onClick={() => void act(() => bookingsApi.resendLink(booking.id))}>
                {t('admin:booking.resendLink')}
              </Button>
            )}
          </div>
          <p className="text-muted-foreground text-xs">{t('admin:booking.resendNote')}</p>
        </div>
      </Section>

      <Section title={t('admin:booking.sections.messages')}>
        {booking.messages.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('admin:booking.noMessages')}</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {booking.messages.map((message) => (
              <li key={message.id} className="flex flex-wrap justify-between gap-2">
                <span>
                  {t(`admin:booking.templates.${message.template ?? message.kind}`, {
                    defaultValue: message.template ?? message.kind,
                  })}
                  <span className="text-muted-foreground"> · {formatDateTime(message.createdAt)}</span>
                </span>
                <span className="text-muted-foreground">
                  {t(`admin:booking.messageStatus.${message.status}`, { defaultValue: message.status })}
                  {message.lastError !== null && ` · ${message.lastError}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </Shell>
  )
}

function Shell({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
      <Link to="/admin/bookings" className="text-muted-foreground self-start text-sm hover:underline">
        ← {t('admin:booking.back')}
      </Link>
      {children}
    </main>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-xl border p-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function Line({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-4 text-sm">
      <span className="text-muted-foreground">{term}</span>
      <span>{children}</span>
    </div>
  )
}

function Payments({
  booking,
  busy,
  onRefund,
}: {
  booking: AdminBooking
  busy: boolean
  onRefund: (paymentId: string, reference: string) => Promise<void>
}) {
  const { t } = useTranslation()
  return (
    <Section title={t('admin:booking.sections.payments')}>
      {booking.payments.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('admin:booking.noPayments')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {booking.payments.map((payment) => (
            <li key={payment.id} className="flex flex-col gap-2 border-b pb-3 last:border-b-0 last:pb-0">
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <span>
                  {t(`admin:booking.paymentKinds.${payment.kind}`, { defaultValue: payment.kind })} ·{' '}
                  <span className="tabular-nums">{formatMoney(payment.amountRwf)}</span>
                </span>
                <span className="text-muted-foreground">
                  {t(`admin:booking.paymentStatus.${payment.status}`, { defaultValue: payment.status })}
                  {payment.settledAt !== null && ` · ${formatDateTime(payment.settledAt)}`}
                </span>
              </div>
              <p className="text-muted-foreground text-xs">
                {t('admin:booking.paymentRefs', {
                  provider: payment.provider,
                  ourRef: payment.ourRef,
                  providerRef: payment.providerRef ?? '—',
                })}
                {payment.refundReference !== null && ` · ${t('admin:booking.refundReference', { reference: payment.refundReference })}`}
              </p>
              {payment.canRecordRefund && <RefundForm payment={payment} busy={busy} onSubmit={onRefund} />}
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

function RefundForm({
  payment,
  busy,
  onSubmit,
}: {
  payment: AdminPayment
  busy: boolean
  onSubmit: (paymentId: string, reference: string) => Promise<void>
}) {
  const { t } = useTranslation()
  const fieldId = useId()

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const reference = String(new FormData(event.currentTarget).get('reference') ?? '').trim()
    if (reference === '') return
    void onSubmit(payment.id, reference)
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={fieldId}>{t('admin:booking.refund.reference')}</Label>
        <Input id={fieldId} name="reference" required className="w-56" />
      </div>
      <Button type="submit" variant="outline" size="sm" aria-disabled={busy}>
        {t('admin:booking.refund.record', { amount: formatMoney(payment.amountRwf) })}
      </Button>
      <p className="text-muted-foreground w-full text-xs">{t('admin:booking.refund.note')}</p>
    </form>
  )
}

function RescheduleForm({
  booking,
  busy,
  onSubmit,
}: {
  booking: AdminBooking
  busy: boolean
  onSubmit: (startsAt: string) => Promise<void>
}) {
  const { t } = useTranslation()
  const fieldId = useId()
  const [value, setValue] = useState(() => kigaliInputValue(booking.schedule.startsAt))

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (value === '') return
    // The field is Kigali wall time whatever zone the browser is in (spec §6.5).
    void onSubmit(`${value}:00${KIGALI_OFFSET}`)
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={fieldId}>{t('admin:booking.reschedule.newStart')}</Label>
        <Input id={fieldId} type="datetime-local" value={value} onChange={(event) => setValue(event.target.value)} className="w-60" />
      </div>
      <Button type="submit" variant="outline" size="sm" aria-disabled={busy}>
        {t('admin:booking.reschedule.move')}
      </Button>
      <p className="text-muted-foreground w-full text-xs">{t('admin:booking.reschedule.note')}</p>
    </form>
  )
}

function CancelForm({ busy, onSubmit }: { busy: boolean; onSubmit: (reason: string | null) => Promise<void> }) {
  const { t } = useTranslation()
  const fieldId = useId()
  const [confirming, setConfirming] = useState(false)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const reason = String(new FormData(event.currentTarget).get('reason') ?? '').trim()
    void onSubmit(reason === '' ? null : reason)
    setConfirming(false)
  }

  if (!confirming) {
    return (
      <Button variant="destructive" className="self-start" onClick={() => setConfirming(true)}>
        {t('admin:booking.cancel.start')}
      </Button>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <p className="text-sm font-medium">{t('admin:booking.cancel.warning')}</p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={fieldId}>{t('admin:booking.cancel.reason')}</Label>
        <Textarea id={fieldId} name="reason" rows={2} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="destructive" size="sm" aria-disabled={busy}>
          {t('admin:booking.cancel.confirm')}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(false)}>
          {t('admin:booking.cancel.keep')}
        </Button>
      </div>
    </form>
  )
}

/** An instant as `datetime-local` wants it, in Kigali wall time: `2026-10-09T11:00`. */
function kigaliInputValue(instant: string): string {
  const date = kigaliDateOf(instant)
  return `${date}T${formatTime(instant)}`
}
