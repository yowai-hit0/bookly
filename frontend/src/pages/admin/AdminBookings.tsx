import { type FormEvent, useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { UnauthenticatedError } from '@/admin/api'
import { BOOKING_STAGES, BOOKING_STATUSES, type BookingListRow, type BookingStage, type BookingStatus, bookingsApi } from '@/admin/bookings'
import { kigaliDateOf } from '@/admin/calendar-dates'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatDate, formatMoney, formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { StageLegend } from '@/pages/StageLegend'

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
    <main className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-semibold">{t('admin:bookings.title')}</h1>

      <section className="flex flex-col gap-3" aria-label={t('admin:bookings.filters.label')}>
        <div className="flex flex-wrap gap-2">
          {BOOKING_STAGES.map((stage) => (
            <Button
              key={stage}
              variant={stages.includes(stage) ? 'default' : 'outline'}
              size="sm"
              aria-pressed={stages.includes(stage)}
              onClick={() => toggleStage(stage)}
            >
              {t(`admin:bookings.stage.${stage}`)}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${searchId}from`}>{t('admin:bookings.filters.from')}</Label>
            <Input
              id={`${searchId}from`}
              type="date"
              value={from}
              onChange={(event) => applyFilter({ from: event.target.value })}
              className="w-44"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${searchId}to`}>{t('admin:bookings.filters.to')}</Label>
            <Input
              id={`${searchId}to`}
              type="date"
              value={to}
              onChange={(event) => applyFilter({ to: event.target.value })}
              className="w-44"
            />
          </div>
          <form onSubmit={submitSearch} className="flex items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${searchId}search`}>{t('admin:bookings.filters.search')}</Label>
              <Input id={`${searchId}search`} name="search" defaultValue={search} className="w-64" />
            </div>
            <Button type="submit" variant="outline" size="sm">
              {t('admin:bookings.filters.apply')}
            </Button>
          </form>
          {(stages.length > 0 || from !== '' || to !== '' || search !== '') && (
            <Button variant="ghost" size="sm" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
              {t('admin:bookings.filters.clear')}
            </Button>
          )}
        </div>
      </section>

      {failed && (
        <p className="text-destructive text-sm" role="alert">
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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] border-collapse text-sm">
            <caption className="sr-only">{t('admin:bookings.title')}</caption>
            <thead>
              <tr className="border-b text-left">
                {(['when', 'reference', 'client', 'service', 'status', 'money'] as const).map((column) => (
                  <th
                    key={column}
                    scope="col"
                    className={cn('text-muted-foreground px-2 py-2 font-medium', column === 'money' && 'text-right')}
                  >
                    {column === 'status' ? (
                      // What each stage means, beside the column that shows them (2026-09-25).
                      <span className="inline-flex items-center gap-1">
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
            <tbody>
              {rows.map((booking) => (
                <tr key={booking.id} className="hover:bg-muted/50 border-b last:border-b-0">
                  <td className="px-2 py-2 align-top whitespace-nowrap">
                    {formatDate(kigaliDateOf(booking.startsAt))}
                    <span className="text-muted-foreground block">
                      {formatTime(booking.startsAt)} – {formatTime(booking.endsAt)}
                    </span>
                  </td>
                  <td className="px-2 py-2 align-top">
                    <Link to={`/admin/bookings/${booking.id}`} className="font-mono font-medium hover:underline">
                      {booking.reference}
                    </Link>
                  </td>
                  <td className="px-2 py-2 align-top">
                    {booking.contactName}
                    <span className="text-muted-foreground block">{booking.contactEmail}</span>
                  </td>
                  <td className="px-2 py-2 align-top">
                    {booking.serviceName}
                    <span className="text-muted-foreground block">{booking.packageName}</span>
                  </td>
                  <td className="px-2 py-2 align-top">
                    <StatusBadge status={booking.stage}>{t(`admin:bookings.stage.${booking.stage}`)}</StatusBadge>
                  </td>
                  <td className="px-2 py-2 text-right align-top tabular-nums">
                    {formatMoney(booking.grandTotalRwf)}
                    {booking.outstandingRwf > 0 && (
                      <span className="text-muted-foreground block">
                        {t('admin:bookings.outstanding', { amount: formatMoney(booking.outstandingRwf) })}
                      </span>
                    )}
                    {booking.hasRefundDue && (
                      <span className="text-destructive block">
                        {t('admin:bookings.refundDue', { amount: formatMoney(booking.refundDueRwf) })}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showing?.nextCursor != null && (
        <Button key={`${LOAD_MORE_KEY}${more}`} variant="outline" className="self-start" onClick={() => void loadMore()} aria-busy={loading}>
          {loading ? t('admin:bookings.loading') : t('admin:bookings.loadMore')}
        </Button>
      )}
    </main>
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
