import { TIME_ZONE } from '@/lib/format'

/**
 * Date arithmetic and labels for the admin calendar (plan.md Task 9).
 *
 * The browser's own timezone plays no part anywhere in this file (spec §6.5).
 * A calendar day is a `YYYY-MM-DD` string, and its arithmetic is done at UTC
 * midnight, where no zone can shift it. An instant becomes a Kigali day
 * through the fixed offset below, and every rendered clock time goes through
 * `Intl` pinned to Africa/Kigali. Nothing calls `getHours()` or `getDate()`.
 */

/** A Kigali calendar date, `YYYY-MM-DD`. A day on his wall, not an instant. */
export type KigaliDate = string

export type CalendarView = 'month' | 'week' | 'day'

export const CALENDAR_VIEWS: readonly CalendarView[] = ['month', 'week', 'day']

const MS_PER_DAY = 86_400_000
/** UTC+2 with no DST (spec §6.5), so a constant is exact. */
const KIGALI_UTC_OFFSET_MS = 2 * 3_600_000
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

// Calendar dates are rendered at UTC midnight in UTC: a date has no zone.
const monthTitleFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  month: 'long',
  year: 'numeric',
})
const dayHeadingFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})
const weekdayFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short' })

/** Years below 100 are refused because the API refuses them (its engine's
 *  `Date.UTC` reads them as 19xx); accepting one here would request a range
 *  that can only fail, instead of falling back to today. */
const MIN_YEAR = 100

export function isKigaliDate(value: string): boolean {
  return (
    DATE_PATTERN.test(value) &&
    Number(value.slice(0, 4)) >= MIN_YEAR &&
    !Number.isNaN(utcMidnight(value)) &&
    toDate(utcMidnight(value)) === value
  )
}

/** The Kigali calendar date an instant falls on. */
export function kigaliDateOf(instant: Date | string): KigaliDate {
  return toDate(new Date(instant).getTime() + KIGALI_UTC_OFFSET_MS)
}

/** Kigali midnight to the next Kigali midnight, as epoch milliseconds. */
export function kigaliDayBounds(date: KigaliDate): { start: number; end: number } {
  const start = utcMidnight(date) - KIGALI_UTC_OFFSET_MS
  return { start, end: start + MS_PER_DAY }
}

export function addDays(date: KigaliDate, days: number): KigaliDate {
  return toDate(utcMidnight(date) + days * MS_PER_DAY)
}

/** The first of the month `months` away from `date`'s month. */
export function shiftMonth(date: KigaliDate, months: number): KigaliDate {
  const [year, month] = date.split('-').map(Number) as [number, number]
  const first = new Date(0)
  // setUTCFullYear, not Date.UTC: Date.UTC reads years 0-99 as 1900-1999.
  first.setUTCFullYear(year, month - 1 + months, 1)
  return toDate(first.getTime())
}

/** Monday of the week containing `date`; weeks start on Monday, as in Rwanda. */
export function startOfWeek(date: KigaliDate): KigaliDate {
  const weekday = new Date(utcMidnight(date)).getUTCDay()
  return addDays(date, -((weekday + 6) % 7))
}

/** The inclusive run of days a view shows -- and so the range it fetches. */
export function visibleRange(view: CalendarView, date: KigaliDate): { from: KigaliDate; to: KigaliDate } {
  switch (view) {
    case 'month': {
      // Whole weeks: from the Monday on or before the 1st to the Sunday on or
      // after the last day.
      const lastOfMonth = addDays(shiftMonth(date, 1), -1)
      return { from: startOfWeek(shiftMonth(date, 0)), to: addDays(startOfWeek(lastOfMonth), 6) }
    }
    case 'week': {
      const from = startOfWeek(date)
      return { from, to: addDays(from, 6) }
    }
    case 'day':
      return { from: date, to: date }
  }
}

/** Where Previous and Next go from `date` in `view`. */
export function stepDate(view: CalendarView, date: KigaliDate, direction: 1 | -1): KigaliDate {
  switch (view) {
    case 'month':
      return shiftMonth(date, direction)
    case 'week':
      return addDays(date, 7 * direction)
    case 'day':
      return addDays(date, direction)
  }
}

export function datesBetween(from: KigaliDate, to: KigaliDate): KigaliDate[] {
  const dates: KigaliDate[] = []
  for (let date = from; date <= to; date = addDays(date, 1)) dates.push(date)
  return dates
}

export function isSameMonth(a: KigaliDate, b: KigaliDate): boolean {
  return a.slice(0, 7) === b.slice(0, 7)
}

/** `08:00`, in Kigali. */
export function formatKigaliTime(instant: string): string {
  return timeFormatter.format(new Date(instant))
}

/** `October 2026`. */
export function formatMonthTitle(date: KigaliDate): string {
  return monthTitleFormatter.format(utcMidnight(date))
}

/** `Wed 7 Oct`. */
export function formatDayHeading(date: KigaliDate): string {
  return dayHeadingFormatter.format(utcMidnight(date))
}

/** `Wed`. */
export function formatWeekday(date: KigaliDate): string {
  return weekdayFormatter.format(utcMidnight(date))
}

function utcMidnight(date: KigaliDate): number {
  return Date.parse(`${date}T00:00:00Z`)
}

function toDate(epochMs: number): KigaliDate {
  return new Date(epochMs).toISOString().slice(0, 10)
}
