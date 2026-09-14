import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router'
import { UnauthenticatedError, adminFetch } from '@/admin/api'
import {
  CALENDAR_VIEWS,
  type CalendarView,
  type KigaliDate,
  formatDayHeading,
  formatMonthTitle,
  isKigaliDate,
  kigaliDateOf,
  stepDate,
  visibleRange,
} from '@/admin/calendar-dates'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { type CalendarData, DayView, MonthView, WeekView } from './CalendarViews'

/**
 * The admin calendar (plan.md Task 9, spec §3.3 step 1): bookings, live holds
 * and blocks in month, week or day view.
 *
 * The view and date live in the URL (`?view=week&date=2026-10-07`), so a reload
 * or a shared link lands on the same page. Each view fetches exactly the days
 * it shows, in one request.
 */

/** A settled request, tagged with the range and attempt it answered. `data` is
 *  null when the request failed. */
type Settled = { key: string; data: CalendarData | null }

const VIEW_COMPONENTS = { month: MonthView, week: WeekView, day: DayView } as const

function isView(value: string | null): value is CalendarView {
  return value !== null && (CALENDAR_VIEWS as readonly string[]).includes(value)
}

export function AdminCalendar() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  const today = kigaliDateOf(new Date())
  const viewParam = params.get('view')
  const dateParam = params.get('date')
  const view: CalendarView = isView(viewParam) ? viewParam : 'month'
  const date: KigaliDate = dateParam !== null && isKigaliDate(dateParam) ? dateParam : today
  const { from, to } = visibleRange(view, date)

  const [attempt, setAttempt] = useState(0)
  const [settled, setSettled] = useState<Settled | null>(null)
  const requestKey = `${from}/${to}/${attempt}`

  useEffect(() => {
    const controller = new AbortController()

    adminFetch<CalendarData>(`/admin/calendar?from=${from}&to=${to}`, { signal: controller.signal })
      .then((data) => setSettled({ key: requestKey, data }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        if (error instanceof UnauthenticatedError) {
          navigate('/admin/login', { replace: true })
          return
        }
        setSettled({ key: requestKey, data: null })
      })

    return () => controller.abort()
  }, [from, to, requestKey, navigate])

  // Loading is derived: a result for any other range or attempt is not shown,
  // so one view never briefly renders another range's data.
  const state =
    settled === null || settled.key !== requestKey
      ? ({ status: 'loading' } as const)
      : settled.data === null
        ? ({ status: 'error' } as const)
        : ({ status: 'ready', data: settled.data } as const)

  function show(nextView: CalendarView, nextDate: KigaliDate) {
    setParams({ view: nextView, date: nextDate })
  }

  const title = view === 'month' ? formatMonthTitle(date) : view === 'week' ? `${formatDayHeading(from)} – ${formatDayHeading(to)}` : formatDayHeading(date)
  const View = VIEW_COMPONENTS[view]

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-4 p-4">
      <Tabs value={view} onValueChange={(value) => isView(value) && show(value, date)}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col">
            <h1 className="text-xl font-semibold">{title}</h1>
            <p className="text-muted-foreground text-xs">{t('admin:calendar.timezoneNote')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="icon" aria-label={t('admin:calendar.previous')} onClick={() => show(view, stepDate(view, date, -1))}>
              <ChevronLeft />
            </Button>
            <Button variant="outline" onClick={() => show(view, today)}>
              {t('admin:calendar.today')}
            </Button>
            <Button variant="outline" size="icon" aria-label={t('admin:calendar.next')} onClick={() => show(view, stepDate(view, date, 1))}>
              <ChevronRight />
            </Button>
            <TabsList>
              {CALENDAR_VIEWS.map((value) => (
                <TabsTrigger key={value} value={value}>
                  {t(`admin:calendar.views.${value}`)}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </div>

        <TabsContent value={view}>
          {state.status === 'loading' && (
            <p className="text-muted-foreground text-sm" role="status">
              {t('admin:calendar.loading')}
            </p>
          )}
          {state.status === 'error' && (
            <div className="flex items-center gap-2" role="alert">
              <p className="text-destructive text-sm">{t('admin:calendar.loadFailed')}</p>
              <Button variant="outline" size="sm" onClick={() => setAttempt((n) => n + 1)}>
                {t('admin:calendar.retry')}
              </Button>
            </div>
          )}
          {state.status === 'ready' && (
            <View data={state.data} from={from} to={to} date={date} today={today} onOpenDay={(day) => show('day', day)} />
          )}
        </TabsContent>
      </Tabs>
    </main>
  )
}
