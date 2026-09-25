import { type FormEvent, type ReactNode, useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { ApiError, UnauthenticatedError } from '@/admin/api'
import { type AdminBooking, type AdminPayment, bookingFromRefusal, bookingsApi } from '@/admin/bookings'
import { type AdminAddon, catalogueApi } from '@/admin/catalogue'
import { kigaliDateOf } from '@/admin/calendar-dates'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StatusBadge } from '@/components/ui/status-badge'
import { Textarea } from '@/components/ui/textarea'
import { formatDate, formatDateTime, formatMoney, formatTime } from '@/lib/format'
import { SELECT_CLASS } from './AdminField'
import { cn } from '@/lib/utils'
import { StageLegend } from '@/pages/StageLegend'

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
      // A refusal carries the booking it refused: that is how the screen
      // catches up with whatever changed underneath, without asking again.
      if (error instanceof ApiError && error.status === 409) {
        const carried = bookingFromRefusal(error)
        if (carried !== null) setBooking(carried)
        else {
          const fresh = await bookingsApi.get(id).catch(() => null)
          if (fresh !== null) setBooking(fresh.booking)
        }
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
  // A load that failed leaves no booking either, so it is answered first:
  // only a 404 means the booking is really gone.
  if (state === 'failed') {
    return (
      <Shell>
        <p className="text-destructive text-sm" role="alert">
          {t('admin:booking.loadFailed')}
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

  const { schedule, money, actions } = booking

  return (
    <Shell>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-mono text-2xl font-semibold">{booking.reference}</h1>
        {/* The display stage (2026-09-25): the stored status read with the clock. */}
        <span className="inline-flex items-center gap-1">
          <StatusBadge status={booking.stage} size="md">
            {t(`admin:bookings.stage.${booking.stage}`)}
          </StatusBadge>
          <StageLegend audience="admin" />
        </span>
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
          <Line
            key={addon.id}
            term={`${addon.name}${addon.quantity > 1 ? ` × ${addon.quantity}` : ''}${
              addon.stage === 'post_shoot' ? ` (${t('admin:booking.postShoot')})` : ''
            }`}
          >
            <span className="flex items-center gap-3">
              <span className="tabular-nums">{formatMoney(addon.amountRwf)}</span>
              {addon.canRemove && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  aria-disabled={busy}
                  onClick={() => void act(() => bookingsApi.removeAddon(booking.id, addon.id))}
                >
                  {t('admin:booking.addons.remove')}
                </Button>
              )}
            </span>
          </Line>
        ))}
        <Line term={t('admin:booking.labels.total')} className="mt-1 border-t pt-2 font-semibold">
          {formatMoney(money.totals.grandTotalRwf)}
        </Line>
        <Line term={t('admin:booking.labels.collected')}>{formatMoney(money.totals.collectedRwf)}</Line>
        {/* Still to pay is the number that needs action, so it is a step heavier while it is above zero. */}
        <Line term={t('admin:booking.labels.outstanding')} className={money.totals.outstandingRwf > 0 ? 'font-semibold' : undefined}>
          {formatMoney(money.totals.outstandingRwf)}
        </Line>
        {money.totals.refundDueRwf > 0 && (
          <Line term={t('admin:booking.labels.refundDue')} className="text-destructive font-semibold">
            {formatMoney(money.totals.refundDueRwf)}
          </Line>
        )}
        {actions.canEditAddons && (
          <div className="mt-2 flex flex-col gap-2 border-t pt-3">
            <p className="text-sm font-medium">{t('admin:booking.addons.title')}</p>
            <AddonForm
              serviceId={booking.service.id}
              busy={busy}
              onAdd={(addonId, quantity) => act(() => bookingsApi.addAddon(booking.id, addonId, quantity))}
            />
            <p className="text-muted-foreground text-xs">{t('admin:booking.addons.note')}</p>
          </div>
        )}
      </Section>

      <Payments booking={booking} busy={busy} onRefund={(paymentId, reference) => act(() => bookingsApi.recordRefund(paymentId, reference))} />

      {actions.canEditDelivery || booking.delivery.url !== null ? (
        <DeliveryForm
          booking={booking}
          busy={busy}
          onSave={(body) => act(() => bookingsApi.saveDelivery(booking.id, body))}
          onSend={(recipient) => act(() => bookingsApi.sendDelivery(booking.id, recipient))}
        />
      ) : (
        // Where the form will be, once the shoot has begun: the photographer
        // otherwise has no way to know it exists (2026-09-25). `canComplete` is
        // the API's "confirmed and the shoot has begun", on its clock.
        actions.canComplete && (
          <Section title={t('admin:booking.sections.delivery')}>
            <p className="text-muted-foreground text-sm">{t('admin:booking.delivery.opensWhenCompleted')}</p>
          </Section>
        )
      )}

      <Section title={t('admin:booking.sections.actions')}>
        <div className="flex flex-col gap-4">
          {actions.canReschedule && <RescheduleForm booking={booking} busy={busy} onSubmit={(startsAt) => act(() => bookingsApi.reschedule(booking.id, startsAt))} />}
          {actions.canCancel && <CancelForm busy={busy} onSubmit={(reason) => act(() => bookingsApi.cancel(booking.id, reason))} />}
          {actions.canRequestSessionFee && (
            <div className="flex flex-col gap-2">
              <Button
                className="self-start"
                aria-disabled={busy}
                onClick={() => void act(() => bookingsApi.requestSessionFee(booking.id))}
              >
                {t('admin:booking.sessionFee.request', { amount: formatMoney(money.totals.outstandingRwf) })}
              </Button>
              <p className="text-muted-foreground text-xs">{t('admin:booking.sessionFee.note')}</p>
            </div>
          )}
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
                  {/* Named only when it went elsewhere than the booking's own address (a one-off delivery recipient). */}
                  {message.recipient !== null && message.recipient !== booking.contact.email && (
                    <span className="text-muted-foreground"> · {t('admin:booking.messageTo', { recipient: message.recipient })}</span>
                  )}
                </span>
                <span className={message.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'}>
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
    <section className="bg-card flex flex-col gap-2 rounded-xl border p-4 shadow-sm">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function Line({ term, children, className }: { term: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap justify-between gap-x-4 text-sm', className)}>
      <span className="text-muted-foreground">{term}</span>
      <span className="tabular-nums">{children}</span>
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
                <span className={payment.status === 'failed' || payment.status === 'refund_due' ? 'text-destructive' : 'text-muted-foreground'}>
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

/**
 * The photos, once the shoot is done (plan.md Task 21; spec §3.5 steps 5-7,
 * §6.20): the link on his own host, the day it stops working, and the email
 * that hands the client both.
 *
 * Saving is not sending. He pastes the link, checks it opens, and sends when
 * he is ready -- and can send again whenever a link is replaced or an email
 * goes astray. The date is left blank to take the default the API dates it
 * with (today plus 90 days, spec A-8).
 */
function DeliveryForm({
  booking,
  busy,
  onSave,
  onSend,
}: {
  booking: AdminBooking
  busy: boolean
  onSave: (body: { url: string; expiresOn?: string; note?: string | null }) => Promise<void>
  /** `recipient` only when the photographer changed the address. */
  onSend: (recipient?: string) => Promise<void>
}) {
  const { t } = useTranslation()
  const fieldId = useId()
  const { delivery, actions } = booking
  const [confirming, setConfirming] = useState(false)
  const [url, setUrl] = useState(delivery.url ?? '')
  const [expiresOn, setExpiresOn] = useState(delivery.expiresOn ?? '')
  const [note, setNote] = useState(delivery.note ?? '')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (url.trim() === '') return
    void onSave({
      url: url.trim(),
      ...(expiresOn === '' ? {} : { expiresOn }),
      note: note.trim() === '' ? null : note.trim(),
    })
  }

  return (
    <Section title={t('admin:booking.sections.delivery')}>
      {delivery.sentAt === null ? (
        <p className="text-muted-foreground text-sm">{t('admin:booking.delivery.unsent')}</p>
      ) : (
        <Line term={t('admin:booking.delivery.sent')}>{formatDateTime(delivery.sentAt)}</Line>
      )}

      {actions.canEditDelivery ? (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${fieldId}url`}>{t('admin:booking.delivery.url')}</Label>
            <Input
              id={`${fieldId}url`}
              type="url"
              inputMode="url"
              placeholder="https://"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${fieldId}expires`}>{t('admin:booking.delivery.expires')}</Label>
              <Input
                id={`${fieldId}expires`}
                type="date"
                value={expiresOn}
                onChange={(event) => setExpiresOn(event.target.value)}
                className="w-44"
              />
            </div>
            <p className="text-muted-foreground text-xs">{t('admin:booking.delivery.expiresHint')}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${fieldId}note`}>{t('admin:booking.delivery.note')}</Label>
            <Textarea id={`${fieldId}note`} rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="outline" size="sm" aria-disabled={busy}>
              {t('admin:booking.delivery.save')}
            </Button>
            {actions.canSendDelivery && !confirming && (
              <Button type="button" size="sm" aria-disabled={busy} onClick={() => setConfirming(true)}>
                {t(delivery.sentAt === null ? 'admin:booking.delivery.send' : 'admin:booking.delivery.sendAgain')}
              </Button>
            )}
          </div>
          <p className="text-muted-foreground text-xs">{t('admin:booking.delivery.note_hint')}</p>
        </form>
      ) : null}

      {actions.canEditDelivery && actions.canSendDelivery && confirming && (
        <ConfirmRecipient
          contactEmail={booking.contact.email}
          busy={busy}
          onBack={() => setConfirming(false)}
          onConfirm={async (recipient) => {
            await onSend(recipient === booking.contact.email ? undefined : recipient)
            setConfirming(false)
          }}
        />
      )}

      {actions.canEditDelivery ? null : (
        <>
          <Line term={t('admin:booking.delivery.url')}>{delivery.url}</Line>
          {delivery.expiresOn !== null && (
            <Line term={t('admin:booking.delivery.expires')}>{formatDate(delivery.expiresOn)}</Line>
          )}
        </>
      )}
    </Section>
  )
}

/**
 * The step between "Send" and the email: who it goes to, prefilled with the
 * booking's address and editable for when the client asked for another. A
 * changed address is for this email only (decided 2026-09-25). Its own form,
 * so Enter in the field confirms rather than saving the link above.
 */
function ConfirmRecipient({
  contactEmail,
  busy,
  onBack,
  onConfirm,
}: {
  contactEmail: string
  busy: boolean
  onBack: () => void
  onConfirm: (recipient: string) => Promise<void>
}) {
  const { t } = useTranslation()
  const fieldId = useId()
  const [recipient, setRecipient] = useState(contactEmail)
  const [invalid, setInvalid] = useState(false)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = recipient.trim()
    // The browser's own email rule, the same one the input shows; the API checks again.
    if (!event.currentTarget.checkValidity() || trimmed === '') {
      setInvalid(true)
      return
    }
    setInvalid(false)
    void onConfirm(trimmed)
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-2 border-t pt-4">
      <p className="text-sm font-medium">{t('admin:booking.delivery.confirmTitle')}</p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={fieldId}>{t('admin:booking.delivery.recipient')}</Label>
        <Input
          id={fieldId}
          type="email"
          autoComplete="off"
          required
          value={recipient}
          aria-invalid={invalid || undefined}
          aria-describedby={`${fieldId}-hint${invalid ? ` ${fieldId}-error` : ''}`}
          onChange={(event) => setRecipient(event.target.value)}
        />
        <p id={`${fieldId}-hint`} className="text-muted-foreground text-xs">
          {t('admin:booking.delivery.recipientHint', { email: contactEmail })}
        </p>
        {invalid && (
          <p id={`${fieldId}-error`} className="text-destructive text-sm">
            {t('admin:booking.delivery.recipientInvalid')}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" aria-disabled={busy}>
          {t('admin:booking.delivery.confirmSend')}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onBack}>
          {t('admin:booking.delivery.back')}
        </Button>
      </div>
    </form>
  )
}

/**
 * The post-shoot add-on picker: what he sells for this service, priced by the
 * catalogue. The API prices it again from the same rows -- a quantity and an id
 * are all that travel, so no amount typed here can decide what a client owes.
 */
function AddonForm({
  serviceId,
  busy,
  onAdd,
}: {
  serviceId: string
  busy: boolean
  onAdd: (addonId: string, quantity: number) => Promise<void>
}) {
  const { t } = useTranslation()
  const fieldId = useId()
  const [choices, setChoices] = useState<AdminAddon[] | 'failed' | null>(null)
  const [addonId, setAddonId] = useState('')
  const [quantity, setQuantity] = useState('1')

  useEffect(() => {
    let cancelled = false
    catalogueApi
      .load()
      .then((catalogue) => {
        if (cancelled) return
        // This service's own add-ons, then the ones sold with everything.
        const own = catalogue.services.find((service) => service.id === serviceId)?.addons ?? []
        setChoices([...own, ...catalogue.sharedAddons].filter((addon) => addon.isActive))
      })
      .catch(() => {
        if (!cancelled) setChoices('failed')
      })
    return () => {
      cancelled = true
    }
  }, [serviceId])

  if (choices === null) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        {t('admin:booking.addons.loading')}
      </p>
    )
  }
  // A list that would not load is not a list of nothing: saying he sells no
  // add-ons when the request failed would be a plain untruth.
  if (choices === 'failed') {
    return (
      <p className="text-destructive text-sm" role="alert">
        {t('admin:booking.addons.loadFailed')}
      </p>
    )
  }
  if (choices.length === 0) return <p className="text-muted-foreground text-sm">{t('admin:booking.addons.none')}</p>

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (addonId === '') return
    void onAdd(addonId, Number(quantity) || 1)
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${fieldId}addon`}>{t('admin:booking.addons.addon')}</Label>
        <select
          id={`${fieldId}addon`}
          value={addonId}
          onChange={(event) => setAddonId(event.target.value)}
          className={SELECT_CLASS}
        >
          <option value="">{t('admin:booking.addons.choose')}</option>
          {choices.map((addon) => (
            <option key={addon.id} value={addon.id}>
              {addon.nameEn} · {formatMoney(addon.priceRwf)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${fieldId}quantity`}>{t('admin:booking.addons.quantity')}</Label>
        <Input
          id={`${fieldId}quantity`}
          type="number"
          min={1}
          max={99}
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          className="w-20"
        />
      </div>
      <Button type="submit" variant="outline" size="sm" aria-disabled={busy}>
        {t('admin:booking.addons.add')}
      </Button>
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
    // Kept out of the row of routine buttons: its own top border and spacing (MASTER, admin-booking-detail.md).
    return (
      <div className="border-t pt-4">
        <Button variant="destructive" className="self-start" onClick={() => setConfirming(true)}>
          {t('admin:booking.cancel.start')}
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 border-t pt-4">
      <p className="text-sm font-medium">{t('admin:booking.cancel.warning')}</p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={fieldId}>{t('admin:booking.cancel.reason')}</Label>
        <Textarea id={fieldId} name="reason" rows={2} />
      </div>
      <div className="flex flex-wrap gap-2">
        {/* Irreversible, so it is the solid red variant, the same one the client booking page uses (MASTER section 6). */}
        <Button
          type="submit"
          variant="destructive-solid"
          size="sm"
          aria-disabled={busy}
        >
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
