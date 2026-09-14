import { TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  type KigaliDate,
  datesBetween,
  formatDayHeading,
  formatKigaliTime,
  formatWeekday,
  isSameMonth,
  kigaliDateOf,
  kigaliDayBounds,
} from '@/admin/calendar-dates'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/**
 * Month, week and day views of `GET /api/admin/calendar` (plan.md Task 9).
 * Built from shadcn primitives and plain grids; no calendar widget.
 *
 * Every entity carries its status as visible text, not colour alone, and a
 * booking that overlaps a block carries a conflict marker (spec §6.4).
 */

export type BookingStatus = 'pending_payment' | 'confirmed' | 'completed' | 'no_show'

export type CalendarBooking = {
  id: string
  reference: string
  status: BookingStatus
  startsAt: string
  endsAt: string
  contactName: string
  serviceName: string
  packageName: string
  conflictsWithBlock: boolean
}

export type CalendarBlock = {
  id: string
  startsAt: string
  endsAt: string
  isAllDay: boolean
  reason: string | null
}

export type CalendarData = {
  bookings: CalendarBooking[]
  blocks: CalendarBlock[]
}

type Entry =
  | { kind: 'booking'; id: string; startsAt: string; booking: CalendarBooking }
  | { kind: 'block'; id: string; startsAt: string; block: CalendarBlock }

type Detail = 'compact' | 'full'

/**
 * What one Kigali day shows: bookings that start on it, and every block that
 * covers any part of it, so a multi-day block appears on each of its days.
 * All-day blocks first, then everything by start time.
 */
function entriesForDay(date: KigaliDate, data: CalendarData): Entry[] {
  const { start, end } = kigaliDayBounds(date)
  const blocks: Entry[] = data.blocks
    .filter((block) => Date.parse(block.startsAt) < end && Date.parse(block.endsAt) > start)
    .map((block) => ({ kind: 'block', id: block.id, startsAt: block.startsAt, block }))
  const bookings: Entry[] = data.bookings
    .filter((booking) => kigaliDateOf(booking.startsAt) === date)
    .map((booking) => ({ kind: 'booking', id: booking.id, startsAt: booking.startsAt, booking }))

  return [...blocks, ...bookings].sort((a, b) => {
    const aAllDay = a.kind === 'block' && a.block.isAllDay
    const bAllDay = b.kind === 'block' && b.block.isAllDay
    if (aAllDay !== bAllDay) return aAllDay ? -1 : 1
    return Date.parse(a.startsAt) - Date.parse(b.startsAt)
  })
}

const STATUS_STYLES: Record<BookingStatus | 'block', string> = {
  confirmed: 'border-l-primary bg-primary/5',
  pending_payment: 'border-l-muted-foreground border-dashed bg-background',
  completed: 'border-l-muted-foreground bg-muted',
  no_show: 'border-l-destructive bg-muted',
  block: 'border-l-foreground/40 bg-muted/60 text-muted-foreground',
}

function timeRange(startsAt: string, endsAt: string): string {
  return `${formatKigaliTime(startsAt)}–${formatKigaliTime(endsAt)}`
}

function CalendarEntry({ entry, detail }: { entry: Entry; detail: Detail }) {
  const { t } = useTranslation()
  const status = entry.kind === 'booking' ? entry.booking.status : 'block'

  return (
    <li
      className={cn('flex flex-col gap-0.5 rounded-md border border-l-4 px-2 py-1 text-xs', STATUS_STYLES[status])}
      data-kind={entry.kind}
      data-status={status}
    >
      <div className="flex flex-wrap items-center gap-1">
        {entry.kind === 'booking' ? (
          <>
            <span className="font-medium tabular-nums">
              {detail === 'full'
                ? timeRange(entry.booking.startsAt, entry.booking.endsAt)
                : formatKigaliTime(entry.booking.startsAt)}
            </span>
            <span className="truncate">{entry.booking.contactName}</span>
          </>
        ) : (
          <span className="font-medium tabular-nums">
            {entry.block.isAllDay
              ? t('admin:calendar.allDay')
              : timeRange(entry.block.startsAt, entry.block.endsAt)}
          </span>
        )}
        <Badge variant={status === 'confirmed' ? 'default' : 'outline'}>
          {t(`admin:calendar.status.${status}`)}
        </Badge>
        {entry.kind === 'booking' && entry.booking.conflictsWithBlock && (
          <Badge variant="destructive" className="h-auto max-w-full whitespace-normal">
            <TriangleAlert aria-hidden="true" />
            {t('admin:calendar.conflict')}
          </Badge>
        )}
      </div>
      {detail === 'full' && entry.kind === 'booking' && (
        <div className="text-muted-foreground">
          {entry.booking.serviceName} · {entry.booking.packageName} · {entry.booking.reference}
        </div>
      )}
      {detail === 'full' && entry.kind === 'block' && entry.block.reason !== null && (
        <div className="text-muted-foreground">{entry.block.reason}</div>
      )}
    </li>
  )
}

function EntryList({ entries, detail }: { entries: Entry[]; detail: Detail }) {
  const { t } = useTranslation()
  if (entries.length === 0) {
    return detail === 'full' ? <p className="text-muted-foreground text-sm">{t('admin:calendar.empty')}</p> : null
  }
  return (
    <ul className="flex flex-col gap-1">
      {entries.map((entry) => (
        <CalendarEntry key={`${entry.kind}:${entry.id}`} entry={entry} detail={detail} />
      ))}
    </ul>
  )
}

type ViewProps = {
  data: CalendarData
  from: KigaliDate
  to: KigaliDate
  /** The date the view is anchored on; the month view dims days outside its month. */
  date: KigaliDate
  today: KigaliDate
  onOpenDay: (date: KigaliDate) => void
}

export function MonthView({ data, from, to, date, today, onOpenDay }: ViewProps) {
  const days = datesBetween(from, to)

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[48rem] grid-cols-7 border-t border-l">
        {days.slice(0, 7).map((day) => (
          <div key={`heading:${day}`} className="text-muted-foreground border-r border-b px-2 py-1 text-xs font-medium">
            {formatWeekday(day)}
          </div>
        ))}
        {days.map((day) => (
          <section
            key={day}
            aria-label={formatDayHeading(day)}
            className={cn('flex min-h-28 flex-col gap-1 border-r border-b p-1', !isSameMonth(day, date) && 'bg-muted/40')}
          >
            <button
              type="button"
              onClick={() => onOpenDay(day)}
              aria-current={day === today ? 'date' : undefined}
              className={cn(
                'self-start rounded px-1 text-xs tabular-nums hover:underline',
                day === today && 'bg-primary text-primary-foreground',
                !isSameMonth(day, date) && day !== today && 'text-muted-foreground',
              )}
            >
              {Number(day.slice(8))}
            </button>
            <EntryList entries={entriesForDay(day, data)} detail="compact" />
          </section>
        ))}
      </div>
    </div>
  )
}

export function WeekView({ data, from, to, today, onOpenDay }: ViewProps) {
  return (
    <div className="grid gap-2 md:grid-cols-7">
      {datesBetween(from, to).map((day) => (
        <section key={day} aria-label={formatDayHeading(day)} className="flex flex-col gap-2 rounded-md border p-2">
          <button
            type="button"
            onClick={() => onOpenDay(day)}
            aria-current={day === today ? 'date' : undefined}
            className={cn('self-start text-sm font-medium hover:underline', day === today && 'text-primary')}
          >
            {formatDayHeading(day)}
          </button>
          <EntryList entries={entriesForDay(day, data)} detail="full" />
        </section>
      ))}
    </div>
  )
}

export function DayView({ data, date }: ViewProps) {
  return (
    <section aria-label={formatDayHeading(date)} className="flex flex-col gap-2">
      <EntryList entries={entriesForDay(date, data)} detail="full" />
    </section>
  )
}
