import type {
  CalendarOptions,
  DatesSetArg,
  EventClickArg,
  EventContentArg,
  EventSourceFuncArg,
  FormatterInput,
} from '@fullcalendar/core'
import enGbLocale from '@fullcalendar/core/locales/en-gb'
import dayGridPlugin from '@fullcalendar/daygrid'
import luxonPlugin from '@fullcalendar/luxon3'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import { CheckCheck, CircleCheck, Clock, type LucideIcon, TriangleAlert, UserX } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router'
import { UnauthenticatedError, adminFetch } from '@/admin/api'
import { availabilityApi, blockFormValues } from '@/admin/availability'
import { CALENDAR_VIEWS, type CalendarView, isKigaliDate, kigaliDateOf } from '@/admin/calendar-dates'
import {
  type BookingStatus,
  type CalendarData,
  type CalendarEntry,
  kigaliRangeOf,
  toEventInputs,
} from '@/admin/calendar-events'
import { Button } from '@/components/ui/button'
import { TIME_ZONE } from '@/lib/format'
import { BlockForm } from './BlockForm'

/**
 * The admin calendar (plan.md Task 9, spec §3.3 step 1): bookings, live holds
 * and blocks in month, week and day views, drawn by FullCalendar.
 *
 * FullCalendar runs in Africa/Kigali through its Luxon plugin, so every time
 * and every day boundary is Kigali's whatever the browser's zone is (spec
 * §6.5). It fetches exactly the range it shows, once per range, through the
 * event source below.
 *
 * The URL records the view and date (`?view=week&date=2026-10-05`): they are
 * read once to open the calendar there, and rewritten whenever he navigates,
 * so a reload or a shared link lands on the same page.
 */

const PLUGINS = [luxonPlugin, dayGridPlugin, timeGridPlugin]

const FULLCALENDAR_VIEW: Record<CalendarView, string> = {
  month: 'dayGridMonth',
  week: 'timeGridWeek',
  day: 'timeGridDay',
}

const HEADER_TOOLBAR = {
  left: 'prev,next today',
  center: 'title',
  right: 'dayGridMonth,timeGridWeek,timeGridDay',
}

const TIME_FORMAT: FormatterInput = { hour: '2-digit', minute: '2-digit', hour12: false }

const VIEW_OPTIONS: CalendarOptions['views'] = {
  dayGridMonth: { dayHeaderFormat: { weekday: 'short' } },
  timeGridWeek: { dayHeaderFormat: { weekday: 'short', day: 'numeric', month: 'short' } },
  timeGridDay: { dayHeaderFormat: { weekday: 'long', day: 'numeric', month: 'long' } },
}

/**
 * Month grows to fit its weeks. The hourly grids scroll inside this height and
 * open at 08:00, so the working day is in view while 01:00 stays reachable.
 * Set from the page, because FullCalendar ignores `height` given per view.
 */
const TIME_GRID_HEIGHT = 760
const SCROLL_TIME = '08:00:00'

function isView(value: string | null): value is CalendarView {
  return value !== null && (CALENDAR_VIEWS as readonly string[]).includes(value)
}

function viewOf(fullCalendarView: string): CalendarView {
  return CALENDAR_VIEWS.find((view) => FULLCALENDAR_VIEW[view] === fullCalendarView) ?? 'month'
}

export function AdminCalendar() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const calendarRef = useRef<FullCalendar>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  // Read once, on mount. From then on FullCalendar owns navigation and the URL
  // follows it, so the two can never disagree.
  const [initial] = useState(() => {
    const view = params.get('view')
    const date = params.get('date')
    return {
      view: FULLCALENDAR_VIEW[isView(view) ? view : 'month'],
      date: date !== null && isKigaliDate(date) ? date : kigaliDateOf(new Date()),
    }
  })

  // Stable identities: a new function or object here would make FullCalendar
  // reset the option, and a new event source would refetch.
  const fetchEvents = useCallback(
    async ({ startStr, endStr }: EventSourceFuncArg) => {
      const { from, to } = kigaliRangeOf(startStr, endStr)
      try {
        const data = await adminFetch<CalendarData>(`/admin/calendar?from=${from}&to=${to}`)
        setFailed(false)
        return toEventInputs(data)
      } catch (error) {
        if (error instanceof UnauthenticatedError) navigate('/admin/login', { replace: true })
        else setFailed(true)
        throw error
      }
    },
    [navigate],
  )

  // FullCalendar reports its first dates while it mounts, before this page's
  // own effects have run -- too early to navigate. The URL is updated from an
  // effect instead.
  const [shown, setShown] = useState<string | null>(null)
  const [viewType, setViewType] = useState(initial.view)
  /** The Kigali dates the view spans, so "Block time" can open on a day in it. */
  const [span, setSpan] = useState({ from: initial.date, to: initial.date })
  const onDatesSet = useCallback(({ view }: DatesSetArg) => {
    setViewType(view.type)
    setShown(`?view=${viewOf(view.type)}&date=${view.calendar.formatIso(view.currentStart, true)}`)
    setSpan({
      from: view.calendar.formatIso(view.currentStart, true).slice(0, 10),
      to: view.calendar.formatIso(view.currentEnd, true).slice(0, 10),
    })
  }, [])

  /** Today when it is on screen, else the first day shown: the likeliest day to block. */
  const today = kigaliDateOf(new Date())
  const blockDate = today >= span.from && today < span.to ? today : span.from

  const [blocking, setBlocking] = useState(false)

  /**
   * Opening what an event stands for: a booking its own page (plan.md Task 19),
   * a block the availability page that edits it. FullCalendar puts every event
   * in the tab order once this is registered and fires it for Enter as well as
   * for a click, so both kinds lead somewhere rather than sitting focusable and
   * inert.
   */
  const onEventClick = useCallback(
    (arg: EventClickArg) => {
      arg.jsEvent.preventDefault()
      const entry = arg.event.extendedProps.entry as CalendarEntry
      navigate(entry.kind === 'booking' ? `/admin/bookings/${entry.booking.id}` : '/admin/availability')
    },
    [navigate],
  )
  useEffect(() => {
    if (shown !== null) navigate({ search: shown }, { replace: true })
  }, [shown, navigate])

  // Switching from month, FullCalendar scrolls to SCROLL_TIME while the grid is
  // still auto-height, so there is nothing to scroll; do it again once the
  // fixed height has rendered. Moving between dates re-applies it on its own.
  useEffect(() => {
    if (viewType !== FULLCALENDAR_VIEW.month) calendarRef.current?.getApi().scrollToTime(SCROLL_TIME)
  }, [viewType])

  const buttonText = useMemo(
    () => ({
      today: t('admin:calendar.today'),
      month: t('admin:calendar.views.month'),
      week: t('admin:calendar.views.week'),
      day: t('admin:calendar.views.day'),
    }),
    [t],
  )
  const buttonHints = useMemo(
    () => ({ prev: t('admin:calendar.previous'), next: t('admin:calendar.next'), today: t('admin:calendar.today') }),
    [t],
  )

  function retry() {
    setFailed(false)
    calendarRef.current?.getApi().refetchEvents()
  }

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col">
          <h1 className="text-xl font-semibold">{t('admin:calendar.title')}</h1>
          <p className="text-muted-foreground text-xs">{t('admin:calendar.timezoneNote')}</p>
        </div>
        {!blocking && <Button onClick={() => setBlocking(true)}>{t('admin:calendar.blockTime')}</Button>}
      </div>

      {/* Blocking time is most often decided while looking at the calendar, so
          the form opens here rather than sending him to the availability page. */}
      {blocking && (
        <BlockForm
          title={t('admin:availability.blocks.new')}
          submitLabel={t('admin:availability.create')}
          values={blockFormValues(undefined, blockDate)}
          onSave={async (payload) => {
            await availabilityApi.createBlock(payload)
            setBlocking(false)
            calendarRef.current?.getApi().refetchEvents()
          }}
          onCancel={() => setBlocking(false)}
        />
      )}

      {loading && (
        <p className="text-muted-foreground text-sm" role="status">
          {t('admin:calendar.loading')}
        </p>
      )}
      {failed && (
        <div className="flex items-center gap-2" role="alert">
          <p className="text-destructive text-sm">{t('admin:calendar.loadFailed')}</p>
          <Button variant="outline" size="sm" onClick={retry}>
            {t('admin:calendar.retry')}
          </Button>
        </div>
      )}

      <FullCalendar
        ref={calendarRef}
        plugins={PLUGINS}
        locale={enGbLocale}
        timeZone={TIME_ZONE}
        initialView={initial.view}
        initialDate={initial.date}
        views={VIEW_OPTIONS}
        headerToolbar={HEADER_TOOLBAR}
        buttonText={buttonText}
        buttonHints={buttonHints}
        allDayText={t('admin:calendar.allDay')}
        firstDay={1}
        fixedWeekCount={false}
        height={viewType === FULLCALENDAR_VIEW.month ? 'auto' : TIME_GRID_HEIGHT}
        scrollTime={SCROLL_TIME}
        navLinks
        eventDisplay="block"
        eventTimeFormat={TIME_FORMAT}
        slotLabelFormat={TIME_FORMAT}
        events={fetchEvents}
        eventSourceFailure={ignoreFailure}
        loading={setLoading}
        datesSet={onDatesSet}
        eventClick={onEventClick}
        eventContent={renderEventContent}
      />
    </main>
  )
}

/** The failure is already shown above the calendar; FullCalendar need not log it. */
function ignoreFailure() {}

function renderEventContent(arg: EventContentArg) {
  return (
    <EventContent
      entry={arg.event.extendedProps.entry as CalendarEntry}
      timeText={arg.timeText}
      detailed={arg.view.type !== FULLCALENDAR_VIEW.month}
    />
  )
}

/**
 * The seven-status icon set (MASTER.md section 7), reused here for the four
 * statuses that can reach the calendar -- a cancelled or expired booking
 * never appears in `CalendarData`. The icon repeats the chip's text label; it
 * never stands in for it (the label is always shown).
 */
const STATUS_ICON: Record<BookingStatus, LucideIcon> = {
  pending_payment: Clock,
  confirmed: CircleCheck,
  completed: CheckCheck,
  no_show: UserX,
}

/**
 * One booking or block. The status is visible text plus an icon, not colour
 * alone, and a booking overlapping a block carries a conflict marker (spec
 * §6.4). Week and day views have room for the service, package and
 * reference, or the block's private reason, and for a slightly larger chip
 * (`design-system/bookly/pages/admin-calendar.md`: 0.7rem in month, 0.75rem
 * where there is more room).
 */
function EventContent({ entry, timeText, detailed }: { entry: CalendarEntry; timeText: string; detailed: boolean }) {
  const { t } = useTranslation()
  const status = entry.kind === 'booking' ? entry.booking.status : 'block'
  const time = timeText !== '' ? timeText : entry.kind === 'block' && entry.block.isAllDay ? t('admin:calendar.allDay') : ''
  const StatusIcon = status === 'block' ? null : STATUS_ICON[status]
  const chipSize = detailed ? 'text-[0.75rem]' : 'text-[0.7rem]'

  return (
    <div className="flex h-full flex-col gap-0.5 overflow-hidden px-1 py-0.5 text-xs" data-kind={entry.kind} data-status={status}>
      <div className="flex flex-wrap items-center gap-1">
        {time !== '' && <span className="font-medium tabular-nums">{time}</span>}
        {entry.kind === 'booking' && <span className="truncate">{entry.booking.contactName}</span>}
        <span className={`inline-flex items-center gap-0.5 rounded border border-current px-1 leading-4 font-medium ${chipSize}`}>
          {StatusIcon !== null && <StatusIcon aria-hidden="true" className="size-3" />}
          {t(`admin:calendar.status.${status}`)}
        </span>
        {entry.kind === 'booking' && entry.booking.conflictsWithBlock && (
          <span className={`bg-destructive inline-flex items-center gap-0.5 rounded px-1 leading-4 font-medium text-white ${chipSize}`}>
            <TriangleAlert aria-hidden="true" className="size-3" />
            {t('admin:calendar.conflict')}
          </span>
        )}
      </div>
      {detailed && entry.kind === 'booking' && (
        <div className="opacity-80">
          {entry.booking.serviceName} · {entry.booking.packageName} · {entry.booking.reference}
        </div>
      )}
      {detailed && entry.kind === 'block' && entry.block.reason !== null && (
        <div className="opacity-80">{entry.block.reason}</div>
      )}
    </div>
  )
}
