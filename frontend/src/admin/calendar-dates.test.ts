import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  type CalendarView,
  addDays,
  datesBetween,
  formatDayHeading,
  formatKigaliTime,
  formatMonthTitle,
  formatWeekday,
  isKigaliDate,
  kigaliDateOf,
  kigaliDayBounds,
  shiftMonth,
  startOfWeek,
  stepDate,
  visibleRange,
} from './calendar-dates'

/**
 * Kigali date math for the admin calendar (plan.md Task 9, spec §6.5). Kigali
 * is UTC+2 with no DST, so Kigali midnight is 22:00 UTC the day before. Weeks
 * start on Monday. 2026-10-01 is a Thursday.
 */

describe('visibleRange', () => {
  it.each<[string, string, string, string]>([
    ['October 2026, Thursday 1st to Saturday 31st', '2026-10-17', '2026-09-28', '2026-11-01'],
    ['June 2026, which starts on a Monday', '2026-06-01', '2026-06-01', '2026-07-05'],
    ['May 2026, which ends on a Sunday', '2026-05-20', '2026-04-27', '2026-05-31'],
    ['February 2027, exactly four whole weeks', '2027-02-14', '2027-02-01', '2027-02-28'],
    ['February 2026, not a leap year', '2026-02-28', '2026-01-26', '2026-03-01'],
    ['February 2028, a leap year', '2028-02-29', '2028-01-31', '2028-03-05'],
    ['August 2026, six weeks', '2026-08-31', '2026-07-27', '2026-09-06'],
    ['December 2026, into the next year', '2026-12-31', '2026-11-30', '2027-01-03'],
  ])('covers %s in whole Monday–Sunday weeks', (_label, date, from, to) => {
    const range = visibleRange('month', date)

    expect(range).toEqual({ from, to })
    const days = datesBetween(range.from, range.to)
    expect(days.length % 7).toBe(0)
    expect(formatWeekday(range.from)).toBe('Mon')
    expect(formatWeekday(range.to)).toBe('Sun')
  })

  it('gives the same month range for every day of the month', () => {
    const ranges = datesBetween('2026-10-01', '2026-10-31').map((date) => visibleRange('month', date))

    expect(new Set(ranges.map((range) => `${range.from}/${range.to}`))).toEqual(new Set(['2026-09-28/2026-11-01']))
  })

  it.each<[string, string, string]>([
    ['2026-10-05', '2026-10-05', '2026-10-11'],
    ['2026-10-07', '2026-10-05', '2026-10-11'],
    ['2026-10-11', '2026-10-05', '2026-10-11'],
    ['2027-01-01', '2026-12-28', '2027-01-03'],
    ['2028-03-01', '2028-02-28', '2028-03-05'],
  ])('gives the week of %s as Monday %s to Sunday %s', (date, from, to) => {
    expect(visibleRange('week', date)).toEqual({ from, to })
  })

  it('gives a day view exactly its own day', () => {
    expect(visibleRange('day', '2026-10-07')).toEqual({ from: '2026-10-07', to: '2026-10-07' })
  })
})

describe('startOfWeek', () => {
  it.each<[string, string, string]>([
    ['a Monday', '2026-10-05', '2026-10-05'],
    ['a Wednesday', '2026-10-07', '2026-10-05'],
    ['a Saturday', '2026-10-10', '2026-10-05'],
    ['a Sunday, the last day of its week', '2026-10-11', '2026-10-05'],
    ['a Sunday at a month start', '2026-11-01', '2026-10-26'],
    ['a Friday at a year start', '2027-01-01', '2026-12-28'],
  ])('takes %s back to its Monday', (_label, date, monday) => {
    expect(startOfWeek(date)).toBe(monday)
  })
})

describe('stepDate', () => {
  it.each<[CalendarView, string, 1 | -1, string]>([
    ['month', '2026-01-31', 1, '2026-02-01'],
    ['month', '2026-03-31', -1, '2026-02-01'],
    ['month', '2026-12-15', 1, '2027-01-01'],
    ['month', '2026-01-15', -1, '2025-12-01'],
    ['week', '2026-10-07', 1, '2026-10-14'],
    ['week', '2026-12-28', 1, '2027-01-04'],
    ['week', '2027-01-03', -1, '2026-12-27'],
    ['day', '2026-12-31', 1, '2027-01-01'],
    ['day', '2026-03-01', -1, '2026-02-28'],
    ['day', '2028-03-01', -1, '2028-02-29'],
  ])('in %s view moves %s by %i to %s', (view, date, direction, expected) => {
    expect(stepDate(view, date, direction)).toBe(expected)
  })

  it('walks twelve months forward and back to where it started', () => {
    let date = '2026-10-01'
    for (let i = 0; i < 12; i++) date = stepDate('month', date, 1)
    expect(date).toBe('2027-10-01')
    for (let i = 0; i < 12; i++) date = stepDate('month', date, -1)
    expect(date).toBe('2026-10-01')
  })
})

describe('shiftMonth, addDays and datesBetween', () => {
  it.each<[string, number, string]>([
    ['2026-10-17', 0, '2026-10-01'],
    ['2026-10-31', 1, '2026-11-01'],
    ['2026-10-31', -10, '2025-12-01'],
    ['2026-10-31', 15, '2028-01-01'],
  ])('shifts %s by %i months to the first, %s', (date, months, expected) => {
    expect(shiftMonth(date, months)).toBe(expected)
  })

  it.each<[string, number, string]>([
    ['2028-02-28', 1, '2028-02-29'],
    ['2027-02-28', 1, '2027-03-01'],
    ['2026-12-31', 1, '2027-01-01'],
    ['2026-01-01', -1, '2025-12-31'],
    ['2026-09-28', 34, '2026-11-01'],
  ])('adds to %s %i days: %s', (date, days, expected) => {
    expect(addDays(date, days)).toBe(expected)
  })

  it('lists the inclusive run of dates, across a year end', () => {
    expect(datesBetween('2026-12-30', '2027-01-02')).toEqual(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02'])
    expect(datesBetween('2026-10-07', '2026-10-07')).toEqual(['2026-10-07'])
    expect(datesBetween('2026-10-08', '2026-10-07')).toEqual([])
  })
})

describe('kigaliDateOf and kigaliDayBounds', () => {
  it.each<[string, string]>([
    ['2026-10-06T21:59:59.999Z', '2026-10-06'],
    ['2026-10-06T22:00:00.000Z', '2026-10-07'],
    ['2026-10-07T00:00:00.000Z', '2026-10-07'],
    ['2026-10-07T21:30:00.000Z', '2026-10-07'],
    ['2026-10-07T23:30:00+02:00', '2026-10-07'],
    ['2026-12-31T22:00:00.000Z', '2027-01-01'],
    ['2028-02-28T22:00:00.000Z', '2028-02-29'],
  ])('puts %s on Kigali date %s', (instant, date) => {
    expect(kigaliDateOf(instant)).toBe(date)
    expect(kigaliDateOf(new Date(instant))).toBe(date)
  })

  it('bounds a Kigali day by 22:00 UTC the evening before and after', () => {
    expect(kigaliDayBounds('2026-10-07')).toEqual({
      start: Date.parse('2026-10-06T22:00:00Z'),
      end: Date.parse('2026-10-07T22:00:00Z'),
    })
  })

  it('agrees with kigaliDateOf at both edges of the day', () => {
    const { start, end } = kigaliDayBounds('2027-01-01')

    expect(kigaliDateOf(new Date(start))).toBe('2027-01-01')
    expect(kigaliDateOf(new Date(end - 1))).toBe('2027-01-01')
    expect(kigaliDateOf(new Date(end))).toBe('2027-01-02')
  })
})

describe('isKigaliDate', () => {
  it.each(['2026-10-07', '2028-02-29', '2026-12-31', '2027-01-01', '0100-01-01'])('accepts %j', (value) => {
    expect(isKigaliDate(value)).toBe(true)
  })

  it.each([
    '',
    '2026-02-29',
    '2026-02-30',
    '2026-04-31',
    '2026-13-01',
    '2026-00-10',
    '2026-10-00',
    '2026-10-7',
    '26-10-07',
    '20261007',
    '2026/10/07',
    '07-10-2026',
    '2026-10-07T00:00:00Z',
    ' 2026-10-07',
    '2026-10-07 ',
    '2026-10-07\n',
    'not-a-date',
    // The API answers 422 below year 100, so the page must fall back to today
    // rather than request a range that can only fail.
    '0050-06-15',
    '0099-12-31',
  ])('refuses %j', (value) => {
    expect(isKigaliDate(value)).toBe(false)
  })
})

describe('formatters', () => {
  it.each<[string, string]>([
    ['2026-10-07T07:00:00.000Z', '09:00'],
    ['2026-10-06T22:00:00.000Z', '00:00'],
    ['2026-10-07T21:30:00.000Z', '23:30'],
    ['2026-10-07T12:05:00.000Z', '14:05'],
  ])('renders %s as Kigali time %s on a 24-hour clock', (instant, time) => {
    expect(formatKigaliTime(instant)).toBe(time)
  })

  it('labels months, days and weekdays in English, by the calendar date alone', () => {
    expect(formatMonthTitle('2026-10-01')).toBe('October 2026')
    expect(formatMonthTitle('2026-10-31')).toBe('October 2026')
    expect(formatDayHeading('2026-10-07')).toBe('Wed 7 Oct')
    expect(formatDayHeading('2027-01-01')).toBe('Fri 1 Jan')
    expect(formatWeekday('2026-10-05')).toBe('Mon')
    expect(formatWeekday('2026-10-11')).toBe('Sun')
  })
})

describe('independence from the machine timezone (spec §6.5)', () => {
  const ORIGINAL_TZ = process.env.TZ

  afterEach(() => {
    if (ORIGINAL_TZ === undefined) delete process.env.TZ
    else process.env.TZ = ORIGINAL_TZ
    vi.resetModules()
  })

  /** Loads the module afresh under `zone`, so module-level formatters are rebuilt in it. */
  async function outputsIn(zone: string) {
    process.env.TZ = zone
    vi.resetModules()
    const dates = await import('./calendar-dates')
    return {
      localHour: new Date('2026-10-07T21:30:00Z').getHours(),
      times: ['2026-10-06T22:00:00Z', '2026-10-07T21:30:00Z', '2026-10-07T03:59:00Z'].map(dates.formatKigaliTime),
      kigaliDates: ['2026-10-06T21:59:59Z', '2026-10-06T22:00:00Z', '2026-10-07T21:30:00Z'].map(dates.kigaliDateOf),
      month: dates.formatMonthTitle('2026-10-01'),
      heading: dates.formatDayHeading('2026-10-07'),
      weekday: dates.formatWeekday('2026-10-11'),
      monthRange: dates.visibleRange('month', '2026-10-31'),
      week: dates.startOfWeek('2026-10-11'),
      bounds: dates.kigaliDayBounds('2026-10-07'),
      valid: dates.isKigaliDate('2026-03-29'),
      step: dates.stepDate('month', '2026-03-31', -1),
    }
  }

  it('gives identical results in Kigali, New York, Kiritimati (UTC+14) and Honolulu (UTC−10)', async () => {
    const kigali = await outputsIn('Africa/Kigali')
    const others = [
      await outputsIn('America/New_York'),
      await outputsIn('Pacific/Kiritimati'),
      await outputsIn('Pacific/Honolulu'),
    ]

    // The zone really changed underneath: 21:30 UTC is a different local hour in each.
    expect([kigali, ...others].map((result) => result.localHour)).toEqual([23, 17, 11, 11])
    expect(kigali).toMatchObject({
      times: ['00:00', '23:30', '05:59'],
      kigaliDates: ['2026-10-06', '2026-10-07', '2026-10-07'],
      month: 'October 2026',
      heading: 'Wed 7 Oct',
      weekday: 'Sun',
      monthRange: { from: '2026-09-28', to: '2026-11-01' },
      week: '2026-10-05',
      valid: true,
      step: '2026-02-01',
    })
    for (const other of others) {
      expect({ ...other, localHour: kigali.localHour }).toEqual(kigali)
    }
  })
})
