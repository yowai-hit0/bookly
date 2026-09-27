import { Check, CircleAlert, ClipboardList, Search, X } from 'lucide-react'
import { type FormEvent, useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { UnauthenticatedError } from '@/admin/api'
import { BOOKING_STAGES, BOOKING_STATUSES, type BookingListRow, type BookingStage, type BookingStatus, bookingsApi } from '@/admin/bookings'
import { kigaliDateOf } from '@/admin/calendar-dates'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StatusBadge, StatusGlyph } from '@/components/ui/status-badge'
import { formatDate, formatMoney, formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { StageLegend } from '@/pages/StageLegend'
import { DATA, EYEBROW, FIELD, META, PAGE, REF_LINK, TD, TH, TR } from './console/classes'
import { PageHeader } from './console/PageHeader'
import { Toolbar, ToolbarCell } from './console/Toolbar'

/**
 * The bookings list (plan.md Task 19): filtered by status and date, searched by
 * reference, name, email or phone, and paged by cursor.
 *
 * The filter lives in the URL, so a filtered list can be reloaded, bookmarked
 * and shared with himself on another device. Paging appends: "Load more" asks
 * for what follows the last row seen, which stays right even as bookings are
 * made and moved under it.
 */

const LOAD_MORE_KEY = 'more'

/**
 * The table stacks by its own width, not the viewport's: with the sidebar, the
 * column between `lg` and about 1150px is narrower than a tablet's. Below 56rem
 * of room each booking is one block; from 56rem the six columns fit (they need
 * about 55rem at the tightest). A cell, when stacked, drops its padding and is
 * indented past the row's status glyph.
 */
const CELL = '@max-[56rem]:block @max-[56rem]:p-0 @max-[56rem]:pl-9'

/** Table cells here are a step tighter than the shared `px-4`, so six columns fit a 1280px screen. */
const TIGHT = 'px-3 first:pl-0 last:pr-0'

export function AdminBookings() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const searchId = useId()

  // The list filters by display stage (2026-09-25). A link from before, with
  // `?status=`, opens on the stages that status now spans, so it still shows
  // the same bookings; the next change to the filter writes `?stage=`.
  const stages = [
    ...new Set([...params.getAll('stage').filter(isStage), ...params.getAll('status').filter(isStatus).flatMap(stagesOfStatus)]),
  ]
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const search = params.get('search') ?? ''
  const filterKey = `${stages.join(',')}|${from}|${to}|${search}`

  const [page, setPage] = useState<{ key: string; rows: BookingListRow[]; nextCursor: string | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [more, setMore] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setFailed(false)
    bookingsApi
      .list({ stages, ...(from === '' ? {} : { from }), ...(to === '' ? {} : { to }), ...(search === '' ? {} : { search }) })
      .then((answer) => {
        if (cancelled) return
        setPage({ key: filterKey, rows: answer.bookings, nextCursor: answer.nextCursor })
        setLoading(false)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        if (error instanceof UnauthenticatedError) {
          void navigate('/admin/login', { replace: true })
          return
        }
        setFailed(true)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // `stages` is rebuilt each render from the URL; `filterKey` is its value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, navigate])

  async function loadMore() {
    const cursor = page?.nextCursor
    if (cursor === undefined || cursor === null || loading) return
    setLoading(true)
    try {
      const answer = await bookingsApi.list({
        stages,
        ...(from === '' ? {} : { from }),
        ...(to === '' ? {} : { to }),
        ...(search === '' ? {} : { search }),
        cursor,
      })
      setPage((current) =>
        current === null ? current : { ...current, rows: [...current.rows, ...answer.bookings], nextCursor: answer.nextCursor },
      )
      setMore((n) => n + 1)
    } catch (error) {
      if (error instanceof UnauthenticatedError) void navigate('/admin/login', { replace: true })
      else setFailed(true)
    } finally {
      setLoading(false)
    }
  }

  function applyFilter(next: { stages?: BookingStage[]; from?: string; to?: string; search?: string }) {
    const query = new URLSearchParams()
    for (const stage of next.stages ?? stages) query.append('stage', stage)
    for (const [key, value] of [
      ['from', next.from ?? from],
      ['to', next.to ?? to],
      ['search', next.search ?? search],
    ] as const) {
      if (value !== '') query.set(key, value)
    }
    setParams(query, { replace: true })
  }

  function toggleStage(stage: BookingStage) {
    applyFilter({ stages: stages.includes(stage) ? stages.filter((s) => s !== stage) : [...stages, stage] })
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    applyFilter({ search: String(new FormData(event.currentTarget).get('search') ?? '').trim() })
  }

  const rows = page?.key === filterKey ? page.rows : []
  const showing = page?.key === filterKey ? page : null

  return (
    <main className={cn(PAGE, 'max-w-6xl')}>
      <PageHeader eyebrow={t('admin:nav.label')} eyebrowIcon={ClipboardList} title={t('admin:bookings.title')} />

      <section className="flex flex-col gap-4" aria-label={t('admin:bookings.filters.label')}>
        <div className="flex flex-wrap gap-2">
          {BOOKING_STAGES.map((stage) => {
            const pressed = stages.includes(stage)
            return (
              <Button
                key={stage}
                // Pressed is the inverted fill plus a check, so it differs by more than colour.
                variant={pressed ? 'default' : 'console-outline'}
                size="console-sm"
                aria-pressed={pressed}
                onClick={() => toggleStage(stage)}
                className="font-normal"
              >
                {pressed && <Check aria-hidden="true" />}
                {t(`admin:bookings.stage.${stage}`)}
              </Button>
            )
          })}
        </div>

        <Toolbar>
          <ToolbarCell className="max-lg:py-2">
            <Label htmlFor={`${searchId}from`} className={cn(EYEBROW, 'shrink-0')}>
              {t('admin:bookings.filters.from')}
            </Label>
            <Input
              id={`${searchId}from`}
              type="date"
              value={from}
              onChange={(event) => applyFilter({ from: event.target.value })}
              className={cn(FIELD, 'w-full px-1 tabular-nums lg:w-40')}
            />
          </ToolbarCell>
          <ToolbarCell className="max-lg:py-2">
            <Label htmlFor={`${searchId}to`} className={cn(EYEBROW, 'shrink-0')}>
              {t('admin:bookings.filters.to')}
            </Label>
            <Input
              id={`${searchId}to`}
              type="date"
              value={to}
              onChange={(event) => applyFilter({ to: event.target.value })}
              className={cn(FIELD, 'w-full px-1 tabular-nums lg:w-40')}
            />
          </ToolbarCell>
          <ToolbarCell grow className="max-lg:py-2">
            <form onSubmit={submitSearch} className="flex min-w-0 flex-1 items-center gap-3">
              <Search aria-hidden="true" className="text-muted-foreground size-4.5 shrink-0" />
              {/* The button beside it says "Search" too, so the field's own label is for assistive tech only. */}
              <Label htmlFor={`${searchId}search`} className="sr-only">
                {t('admin:bookings.filters.search')}
              </Label>
              <Input id={`${searchId}search`} name="search" defaultValue={search} className={cn(FIELD, 'min-w-0 flex-1 px-1')} />
              <Button type="submit" variant="console-outline" size="console-sm">
                {t('admin:bookings.filters.apply')}
              </Button>
            </form>
          </ToolbarCell>
          {(stages.length > 0 || from !== '' || to !== '' || search !== '') && (
            <ToolbarCell className="max-lg:py-2">
              <Button variant="ghost" size="console-sm" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                <X aria-hidden="true" />
                {t('admin:bookings.filters.clear')}
              </Button>
            </ToolbarCell>
          )}
        </Toolbar>
      </section>

      {failed && (
        <p className="text-destructive flex items-start gap-2 text-sm" role="alert">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {t('admin:bookings.loadFailed')}
        </p>
      )}

      {showing === null && loading && (
        <p className="text-muted-foreground text-sm" role="status">
          {t('admin:bookings.loading')}
        </p>
      )}

      {showing !== null && rows.length === 0 && <p className="text-muted-foreground text-sm">{t('admin:bookings.empty')}</p>}

      {rows.length > 0 && (
        // From `md` a table with columns; on a phone each booking stacks into one
        // block, so nothing scrolls sideways. The explicit roles keep it a table
        // for assistive tech after `display` changes (Safari drops table
        // semantics without them). On a phone only the Status header stays in
        // view, because it carries the legend.
        <div className="@container overflow-x-auto">
          <table role="table" className="w-full border-collapse text-[0.9375rem]">
            <caption className="sr-only">{t('admin:bookings.title')}</caption>
            <thead role="rowgroup" className="@max-[56rem]:block">
              <tr role="row" className="border-b @max-[56rem]:flex">
                {(['when', 'reference', 'client', 'service', 'status', 'money'] as const).map((column) => (
                  <th
                    key={column}
                    role="columnheader"
                    scope="col"
                    className={cn(
                      TH,
                      TIGHT,
                      column === 'money' && 'text-right',
                      column !== 'status' && '@max-[56rem]:hidden',
                      '@max-[56rem]:px-0',
                    )}
                  >
                    {column === 'status' ? (
                      // What each stage means, beside the column that shows them (2026-09-25).
                      <span className="-my-2 inline-flex items-center gap-1">
                        {t(`admin:bookings.columns.${column}`)}
                        <StageLegend audience="admin" />
                      </span>
                    ) : (
                      t(`admin:bookings.columns.${column}`)
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody role="rowgroup" className="@max-[56rem]:block">
              {rows.map((booking) => (
                <tr
                  key={booking.id}
                  role="row"
                  className={cn(TR, '@max-[56rem]:flex @max-[56rem]:flex-col @max-[56rem]:gap-2 @max-[56rem]:py-4')}
                >
                  <td role="cell" className={cn(TD, TIGHT, CELL, '@max-[56rem]:pl-0 @min-[56rem]:whitespace-nowrap')}>
                    <div className="flex items-start gap-3.5">
                      <StatusGlyph status={booking.stage} className="mt-px" />
                      <div className="flex flex-col gap-1">
                        <span>{formatDate(kigaliDateOf(booking.startsAt))}</span>
                        <span className={cn(META, 'font-mono tabular-nums')}>
                          {formatTime(booking.startsAt)} – {formatTime(booking.endsAt)}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td role="cell" className={cn(TD, TIGHT, CELL, 'whitespace-nowrap')}>
                    <Link
                      to={`/admin/bookings/${booking.id}`}
                      // 44px to a thumb below `lg`. In the table row (from `md`) a
                      // negative margin keeps the row from growing; stacked on a
                      // phone it takes its full height so it never overlaps a neighbour.
                      className={cn(
                        REF_LINK,
                        'inline-flex items-center max-lg:min-h-11 pointer-coarse:min-h-11 @min-[56rem]:max-lg:-my-3 @min-[56rem]:pointer-coarse:-my-3',
                      )}
                    >
                      {booking.reference}
                    </Link>
                  </td>
                  <td role="cell" className={cn(TD, TIGHT, CELL)}>
                    <div className="flex flex-col gap-1">
                      <span>{booking.contactName}</span>
                      <span className={cn(META, 'wrap-break-word')}>{breakableEmail(booking.contactEmail)}</span>
                    </div>
                  </td>
                  <td role="cell" className={cn(TD, TIGHT, CELL)}>
                    <div className="flex flex-col gap-1">
                      <span>{booking.serviceName}</span>
                      <span className={META}>{booking.packageName}</span>
                    </div>
                  </td>
                  <td role="cell" className={cn(TD, TIGHT, CELL)}>
                    <StatusBadge status={booking.stage}>{t(`admin:bookings.stage.${booking.stage}`)}</StatusBadge>
                  </td>
                  <td role="cell" className={cn(TD, TIGHT, CELL, '@min-[56rem]:text-right')}>
                    <div className="flex flex-col gap-1 @min-[56rem]:items-end">
                      <span className={cn(DATA, 'whitespace-nowrap')}>{formatMoney(booking.grandTotalRwf)}</span>
                      {booking.outstandingRwf > 0 && (
                        <span className={META}>
                          {keepAmountWhole(
                            t('admin:bookings.outstanding', { amount: formatMoney(booking.outstandingRwf) }),
                            formatMoney(booking.outstandingRwf),
                          )}
                        </span>
                      )}
                      {booking.hasRefundDue && (
                        <span className="text-destructive text-sm">
                          {keepAmountWhole(
                            t('admin:bookings.refundDue', { amount: formatMoney(booking.refundDueRwf) }),
                            formatMoney(booking.refundDueRwf),
                          )}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showing?.nextCursor != null && (
        <Button
          key={`${LOAD_MORE_KEY}${more}`}
          variant="console-outline"
          size="console"
          className="self-start"
          onClick={() => void loadMore()}
          aria-busy={loading}
        >
          {loading ? t('admin:bookings.loading') : t('admin:bookings.loadMore')}
        </Button>
      )}
    </main>
  )
}

/**
 * A sentence with an amount in it ("30,000 RWF still to pay") that may wrap
 * between its words but never inside the amount. The text is unchanged.
 */
function keepAmountWhole(sentence: string, amount: string) {
  const at = sentence.indexOf(amount)
  if (at < 0) return sentence
  return (
    <>
      {sentence.slice(0, at)}
      <span className="whitespace-nowrap">{amount}</span>
      {sentence.slice(at + amount.length)}
    </>
  )
}

/**
 * An email that wraps at its `@` in a narrow column rather than mid-word. The
 * `<wbr>` adds a break opportunity without changing the text.
 */
function breakableEmail(email: string) {
  const at = email.indexOf('@')
  if (at <= 0) return email
  return (
    <>
      {email.slice(0, at)}
      <wbr />
      {email.slice(at)}
    </>
  )
}

function isStatus(value: string): value is BookingStatus {
  return (BOOKING_STATUSES as readonly string[]).includes(value)
}

function isStage(value: string): value is BookingStage {
  return (BOOKING_STAGES as readonly string[]).includes(value)
}

/** The stages a stored status spans, for links made before stages. */
function stagesOfStatus(status: BookingStatus): BookingStage[] {
  switch (status) {
    case 'pending_payment':
      return ['awaiting_payment']
    case 'confirmed':
      return ['confirmed', 'in_progress', 'needs_review']
    case 'completed':
      return ['completed', 'closed']
    default:
      return [status]
  }
}
