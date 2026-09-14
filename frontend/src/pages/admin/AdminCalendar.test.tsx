import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/i18n'
import { readSession, saveSession } from '@/admin/session'
import { routes } from '@/routes'
import type { CalendarBlock, CalendarBooking, CalendarData } from './CalendarViews'

/**
 * The admin calendar (plan.md Task 9; spec §3.3 step 1, §6.4, §6.5), rendered
 * through the real routes with `fetch` stubbed.
 *
 * The clock is fixed at 2026-10-31 22:30 UTC -- already 00:30 on Sunday
 * 1 November in Kigali -- so "today" differs by date, week-day and month
 * depending on whether it is taken in Kigali or in UTC. Kigali is UTC+2.
 */

const NOW = new Date('2026-10-31T22:30:00.000Z')
const TOKEN = 'header.payload.signature'
const CALENDAR_API = '/api/admin/calendar'

const LABELS: Record<string, string> = {
  confirmed: 'Confirmed',
  pending_payment: 'Hold',
  completed: 'Completed',
  no_show: 'No-show',
  block: 'Blocked',
}
const CONFLICT = 'Conflicts with a block'

// --- Fixtures ---------------------------------------------------------------

function booking(fields: Pick<CalendarBooking, 'id' | 'reference' | 'startsAt' | 'endsAt'> & Partial<CalendarBooking>): CalendarBooking {
  return {
    status: 'confirmed',
    contactName: 'Aline Uwase',
    serviceName: 'Portrait',
    packageName: 'Standard',
    conflictsWithBlock: false,
    ...fields,
  }
}

function block(fields: Pick<CalendarBlock, 'id' | 'startsAt' | 'endsAt'> & Partial<CalendarBlock>): CalendarBlock {
  return { isAllDay: false, reason: null, ...fields }
}

/** October 2026: three confirmed bookings, one live hold, one block over the first booking. */
const OCTOBER: CalendarData = {
  bookings: [
    booking({
      id: 'b1',
      reference: 'BKY-2610-00001',
      startsAt: '2026-10-07T07:00:00.000Z',
      endsAt: '2026-10-07T08:00:00.000Z',
      contactName: 'Grace Mukamana',
      serviceName: 'Wedding',
      packageName: 'Full day',
      conflictsWithBlock: true,
    }),
    booking({
      id: 'b2',
      reference: 'BKY-2610-00002',
      startsAt: '2026-10-15T12:00:00.000Z',
      endsAt: '2026-10-15T13:00:00.000Z',
      contactName: 'Eric Habimana',
    }),
    booking({
      id: 'b4',
      reference: 'BKY-2610-00004',
      status: 'pending_payment',
      startsAt: '2026-10-20T09:00:00.000Z',
      endsAt: '2026-10-20T10:00:00.000Z',
      contactName: 'Claudine Ingabire',
    }),
    // 23:30 Kigali on Friday 23rd -- 21:30 UTC, but past midnight in many zones east of Kigali.
    booking({
      id: 'b3',
      reference: 'BKY-2610-00003',
      startsAt: '2026-10-23T21:30:00.000Z',
      endsAt: '2026-10-23T22:00:00.000Z',
      contactName: 'Divine Uwera',
    }),
  ],
  blocks: [
    block({ id: 'k1', startsAt: '2026-10-07T07:30:00.000Z', endsAt: '2026-10-07T09:00:00.000Z', reason: 'Clinic' }),
  ],
}

const EMPTY: CalendarData = { bookings: [], blocks: [] }

type FetchInput = string | URL | Request
type Handler = (url: string) => Response | Promise<Response>

/**
 * A `fetch` that answers with `handler` and, like the real one, rejects with
 * an AbortError once its signal aborts.
 */
function stubFetch(handler: Handler = () => json(OCTOBER)) {
  const mock = vi.fn(
    (input: FetchInput, init: RequestInit = {}) =>
      new Promise<Response>((resolve, reject) => {
        const abort = () => reject(new DOMException('The operation was aborted.', 'AbortError'))
        if (init.signal?.aborted) return abort()
        init.signal?.addEventListener('abort', abort)
        Promise.resolve()
          .then(() => handler(String(input)))
          .then(resolve, reject)
      }),
  )
  vi.stubGlobal('fetch', mock)
  return mock
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function calendarUrl(from: string, to: string): string {
  return `${CALENDAR_API}?from=${from}&to=${to}`
}

function requestedUrls(mock: ReturnType<typeof stubFetch>): string[] {
  return mock.mock.calls.map(([input]) => String(input))
}

function signIn(expiresAt = '2026-11-01T06:30:00.000Z') {
  saveSession({ token: TOKEN, expiresAt })
}

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

function user() {
  return userEvent.setup({ delay: null })
}

function day(name: string): HTMLElement {
  return screen.getByRole('region', { name })
}

function itemsIn(region: HTMLElement): HTMLElement[] {
  return within(region).queryAllByRole('listitem')
}

/** Which status labels an entry shows, of all the labels there are. */
function labelsIn(item: HTMLElement): string[] {
  return Object.values(LABELS).filter((label) => within(item).queryByText(label) !== null)
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  sessionStorage.clear()
})

// --- Month view: plan.md Task 9 verification ------------------------------------------

describe('month view', () => {
  it('renders 3 confirmed bookings, 1 live hold and 1 block as 5 distinguishable entities, each labelled with its status', async () => {
    signIn()
    stubFetch()
    renderAt('/admin/calendar?view=month&date=2026-10-07')

    const items = await screen.findAllByRole('listitem')

    expect(items).toHaveLength(5)
    expect(items.map((item) => [item.dataset.kind, item.dataset.status, labelsIn(item)])).toEqual([
      ['booking', 'confirmed', ['Confirmed']],
      ['block', 'block', ['Blocked']],
      ['booking', 'confirmed', ['Confirmed']],
      ['booking', 'pending_payment', ['Hold']],
      ['booking', 'confirmed', ['Confirmed']],
    ])
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('Grace Mukamana'),
      expect.stringContaining('09:30–11:00'),
      expect.stringContaining('Eric Habimana'),
      expect.stringContaining('Claudine Ingabire'),
      expect.stringContaining('Divine Uwera'),
    ])
  })

  it('marks the booking that overlaps a block with a conflict marker, and no other entry (spec §6.4)', async () => {
    signIn()
    stubFetch()
    renderAt('/admin/calendar?view=month&date=2026-10-07')

    const items = await screen.findAllByRole('listitem')

    expect(screen.getAllByText(CONFLICT)).toHaveLength(1)
    expect(items.map((item) => within(item).queryByText(CONFLICT) !== null)).toEqual([true, false, false, false, false])
    expect(items[0]).toHaveTextContent('Grace Mukamana')
  })

  it('labels every status in words, not colour alone', async () => {
    signIn()
    stubFetch(() =>
      json({
        bookings: (['confirmed', 'pending_payment', 'completed', 'no_show'] as const).map((status, index) =>
          booking({
            id: `s${index}`,
            reference: `BKY-2610-0001${index}`,
            status,
            startsAt: `2026-10-0${index + 5}T07:00:00.000Z`,
            endsAt: `2026-10-0${index + 5}T08:00:00.000Z`,
          }),
        ),
        blocks: [block({ id: 'k1', startsAt: '2026-10-08T22:00:00.000Z', endsAt: '2026-10-09T22:00:00.000Z', isAllDay: true })],
      }),
    )
    renderAt('/admin/calendar?view=month&date=2026-10-07')

    const items = await screen.findAllByRole('listitem')

    expect(items.map((item) => [item.dataset.status, labelsIn(item)])).toEqual([
      ['confirmed', ['Confirmed']],
      ['pending_payment', ['Hold']],
      ['completed', ['Completed']],
      ['no_show', ['No-show']],
      ['block', ['Blocked']],
    ])
    expect(items[4]).toHaveTextContent('All day')
  })

  it('draws whole Monday–Sunday weeks with the Kigali-time note', async () => {
    signIn()
    stubFetch()
    renderAt('/admin/calendar?view=month&date=2026-10-07')

    await screen.findAllByRole('listitem')

    expect(screen.getByRole('heading', { level: 1, name: 'October 2026' })).toBeInTheDocument()
    expect(screen.getByText('All times are Kigali time (UTC+2).')).toBeInTheDocument()
    const days = screen.getAllByRole('region')
    expect(days).toHaveLength(35)
    expect(days[0]).toHaveAccessibleName('Mon 28 Sept')
    expect(days[34]).toHaveAccessibleName('Sun 1 Nov')
  })

  it('puts each entry on its Kigali date, the 23:30 booking included', async () => {
    signIn()
    stubFetch()
    renderAt('/admin/calendar?view=month&date=2026-10-07')

    await screen.findAllByRole('listitem')

    const friday = itemsIn(day('Fri 23 Oct'))
    expect(friday).toHaveLength(1)
    expect(friday[0]).toHaveTextContent('23:30')
    expect(friday[0]).toHaveTextContent('Divine Uwera')
    expect(itemsIn(day('Sat 24 Oct'))).toEqual([])
    expect(itemsIn(day('Wed 7 Oct')).map((item) => item.dataset.kind)).toEqual(['booking', 'block'])
    expect(itemsIn(day('Tue 6 Oct'))).toEqual([])
  })

  it('opens the day view from a day number', async () => {
    signIn()
    const mock = stubFetch()
    const router = renderAt('/admin/calendar?view=month&date=2026-10-07')
    await screen.findAllByRole('listitem')

    await user().click(within(day('Thu 15 Oct')).getByRole('button', { name: '15' }))

    await waitFor(() => expect(requestedUrls(mock).at(-1)).toBe(calendarUrl('2026-10-15', '2026-10-15')))
    expect(new URLSearchParams(router.state.location.search).toString()).toBe('view=day&date=2026-10-15')
    expect(await screen.findByRole('heading', { level: 1, name: 'Thu 15 Oct' })).toBeInTheDocument()
  })

  it('marks Kigali today, not the UTC date', async () => {
    signIn()
    stubFetch(() => json(EMPTY))
    renderAt('/admin/calendar?view=month&date=2026-10-07')

    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())

    expect(within(day('Sun 1 Nov')).getByRole('button')).toHaveAttribute('aria-current', 'date')
    expect(within(day('Sat 31 Oct')).getByRole('button')).not.toHaveAttribute('aria-current')
  })
})

// --- Week and day views ----------------------------------------------------------------------

describe('week and day views', () => {
  it('lists each day’s entries with time range, service, package, reference and block reason', async () => {
    signIn()
    stubFetch()
    renderAt('/admin/calendar?view=week&date=2026-10-07')

    const wednesday = await screen.findByRole('region', { name: 'Wed 7 Oct' })
    const [first, second] = itemsIn(wednesday)

    expect(screen.getByRole('heading', { level: 1, name: 'Mon 5 Oct – Sun 11 Oct' })).toBeInTheDocument()
    expect(first).toHaveAttribute('data-status', 'confirmed')
    expect(first).toHaveTextContent('09:00–10:00')
    expect(first).toHaveTextContent('Grace Mukamana')
    expect(first).toHaveTextContent('Wedding · Full day · BKY-2610-00001')
    expect(first).toHaveTextContent(CONFLICT)
    expect(second).toHaveAttribute('data-status', 'block')
    expect(second).toHaveTextContent('09:30–11:00')
    expect(second).toHaveTextContent('Blocked')
    expect(second).toHaveTextContent('Clinic')
    expect(within(day('Mon 5 Oct')).getByText('Nothing scheduled.')).toBeInTheDocument()
    expect(screen.getAllByRole('region')).toHaveLength(7)
  })

  it('shows the 23:30 booking at the end of its own Kigali day in week view', async () => {
    signIn()
    stubFetch()
    renderAt('/admin/calendar?view=week&date=2026-10-23')

    const friday = await screen.findByRole('region', { name: 'Fri 23 Oct' })

    expect(itemsIn(friday)).toHaveLength(1)
    expect(friday).toHaveTextContent('23:30–00:00')
    expect(within(day('Sat 24 Oct')).getByText('Nothing scheduled.')).toBeInTheDocument()
  })

  it('shows a day alone in day view, with the same detail', async () => {
    signIn()
    stubFetch()
    renderAt('/admin/calendar?view=day&date=2026-10-07')

    const wednesday = await screen.findByRole('region', { name: 'Wed 7 Oct' })

    expect(screen.getAllByRole('region')).toHaveLength(1)
    expect(itemsIn(wednesday).map((item) => item.dataset.status)).toEqual(['confirmed', 'block'])
    expect(wednesday).toHaveTextContent('Wedding · Full day · BKY-2610-00001')
    expect(wednesday).toHaveTextContent('Clinic')
  })

  it('says nothing is scheduled on an empty day', async () => {
    signIn()
    stubFetch()
    renderAt('/admin/calendar?view=day&date=2026-10-08')

    const thursday = await screen.findByRole('region', { name: 'Thu 8 Oct' })

    expect(itemsIn(thursday)).toEqual([])
    expect(within(thursday).getByText('Nothing scheduled.')).toBeInTheDocument()
  })

  it('shows a multi-day block on every day it covers, and a block across midnight on both days', async () => {
    signIn()
    stubFetch(() =>
      json({
        bookings: [],
        blocks: [
          // All day Monday 12th to Wednesday 14th, Kigali.
          block({
            id: 'trip',
            startsAt: '2026-10-11T22:00:00.000Z',
            endsAt: '2026-10-14T22:00:00.000Z',
            isAllDay: true,
            reason: 'Travelling to Musanze',
          }),
          // Friday 22:00 to Saturday 02:00, Kigali.
          block({ id: 'late', startsAt: '2026-10-16T20:00:00.000Z', endsAt: '2026-10-17T00:00:00.000Z', reason: 'Night shoot' }),
        ],
      }),
    )
    renderAt('/admin/calendar?view=week&date=2026-10-14')

    await screen.findAllByRole('listitem')

    const covered = ['Mon 12 Oct', 'Tue 13 Oct', 'Wed 14 Oct'].map((name) => itemsIn(day(name)))
    for (const items of covered) {
      expect(items).toHaveLength(1)
      expect(items[0]).toHaveAttribute('data-status', 'block')
      expect(items[0]).toHaveTextContent('All day')
      expect(items[0]).toHaveTextContent('Travelling to Musanze')
    }
    expect(itemsIn(day('Thu 15 Oct'))).toEqual([])
    for (const name of ['Fri 16 Oct', 'Sat 17 Oct']) {
      const items = itemsIn(day(name))
      expect(items).toHaveLength(1)
      expect(items[0]).toHaveTextContent('22:00–02:00')
    }
    expect(itemsIn(day('Sun 18 Oct'))).toEqual([])
  })

  it('lists all-day blocks first, then everything by start time', async () => {
    signIn()
    stubFetch(() =>
      json({
        bookings: [
          booking({ id: 'late', reference: 'LATE', startsAt: '2026-10-07T14:00:00.000Z', endsAt: '2026-10-07T15:00:00.000Z' }),
          booking({ id: 'early', reference: 'EARLY', startsAt: '2026-10-07T06:00:00.000Z', endsAt: '2026-10-07T07:00:00.000Z' }),
        ],
        blocks: [
          block({ id: 'noon', startsAt: '2026-10-07T10:00:00.000Z', endsAt: '2026-10-07T11:00:00.000Z', reason: 'Lunch' }),
          block({ id: 'all', startsAt: '2026-10-05T22:00:00.000Z', endsAt: '2026-10-07T22:00:00.000Z', isAllDay: true, reason: 'Holiday' }),
        ],
      }),
    )
    renderAt('/admin/calendar?view=day&date=2026-10-07')

    const items = await screen.findAllByRole('listitem')

    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('Holiday'),
      expect.stringContaining('EARLY'),
      expect.stringContaining('Lunch'),
      expect.stringContaining('LATE'),
    ])
  })
})

// --- Fetching exactly the visible range ---------------------------------------------------------

describe('fetching', () => {
  it.each<[string, string, string]>([
    ['view=month&date=2026-10-07', '2026-09-28', '2026-11-01'],
    ['view=month&date=2026-02-10', '2026-01-26', '2026-03-01'],
    ['view=week&date=2026-10-07', '2026-10-05', '2026-10-11'],
    ['view=week&date=2026-10-11', '2026-10-05', '2026-10-11'],
    ['view=day&date=2026-10-07', '2026-10-07', '2026-10-07'],
  ])('?%s requests from=%s to=%s, once', async (query, from, to) => {
    signIn()
    const mock = stubFetch(() => json(EMPTY))
    renderAt(`/admin/calendar?${query}`)

    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())

    expect(requestedUrls(mock)).toEqual([calendarUrl(from, to)])
  })

  it('sends the stored token as a bearer header', async () => {
    signIn()
    const mock = stubFetch()
    renderAt('/admin/calendar?view=month&date=2026-10-07')

    await screen.findAllByRole('listitem')

    const init = mock.mock.calls[0]?.[1]
    expect(new Headers(init?.headers).get('Authorization')).toBe(`Bearer ${TOKEN}`)
  })

  it.each<[string, string, string, string]>([
    ['no parameters', '', calendarUrl('2026-10-26', '2026-12-06'), 'November 2026'],
    ['an unknown view', '?view=year&date=2026-10-07', calendarUrl('2026-09-28', '2026-11-01'), 'October 2026'],
    ['a view in the wrong case', '?view=Week&date=2026-10-07', calendarUrl('2026-09-28', '2026-11-01'), 'October 2026'],
    ['an impossible date', '?view=day&date=2026-02-30', calendarUrl('2026-11-01', '2026-11-01'), 'Sun 1 Nov'],
    ['a malformed date', '?view=day&date=1-11-2026', calendarUrl('2026-11-01', '2026-11-01'), 'Sun 1 Nov'],
    ['a datetime for a date', '?view=month&date=2026-10-07T00:00:00Z', calendarUrl('2026-10-26', '2026-12-06'), 'November 2026'],
  ])('with %s falls back to month view and Kigali today', async (_label, query, url, title) => {
    signIn()
    const mock = stubFetch(() => json(EMPTY))
    renderAt(`/admin/calendar${query}`)

    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument()
    await waitFor(() => expect(requestedUrls(mock)).toEqual([url]))
  })

  it('moves a month with Previous and Next, and back to the Kigali month with Today', async () => {
    signIn()
    const mock = stubFetch(() => json(EMPTY))
    const router = renderAt('/admin/calendar?view=month&date=2026-10-07')
    const u = user()
    const title = (name: string) => screen.findByRole('heading', { level: 1, name })
    await title('October 2026')

    await u.click(screen.getByRole('button', { name: 'Next' }))
    await title('November 2026')
    expect(router.state.location.search).toBe('?view=month&date=2026-11-01')

    await u.click(screen.getByRole('button', { name: 'Previous' }))
    await u.click(screen.getByRole('button', { name: 'Previous' }))
    await title('September 2026')

    await u.click(screen.getByRole('button', { name: 'Today' }))
    await title('November 2026')
    expect(router.state.location.search).toBe('?view=month&date=2026-11-01')

    await waitFor(() =>
      expect(requestedUrls(mock)).toEqual([
        calendarUrl('2026-09-28', '2026-11-01'),
        calendarUrl('2026-10-26', '2026-12-06'),
        calendarUrl('2026-09-28', '2026-11-01'),
        calendarUrl('2026-08-31', '2026-10-04'),
        calendarUrl('2026-10-26', '2026-12-06'),
      ]),
    )
  })

  it('steps a week at a time in week view, across a year end', async () => {
    signIn()
    const mock = stubFetch(() => json(EMPTY))
    const router = renderAt('/admin/calendar?view=week&date=2026-12-30')
    await screen.findByRole('heading', { level: 1, name: 'Mon 28 Dec – Sun 3 Jan' })

    await user().click(screen.getByRole('button', { name: 'Next' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Mon 4 Jan – Sun 10 Jan' })).toBeInTheDocument()
    expect(router.state.location.search).toBe('?view=week&date=2027-01-06')
    await waitFor(() => expect(requestedUrls(mock).at(-1)).toBe(calendarUrl('2027-01-04', '2027-01-10')))
  })

  it('steps a day at a time in day view', async () => {
    signIn()
    const mock = stubFetch(() => json(EMPTY))
    renderAt('/admin/calendar?view=day&date=2026-12-31')
    await screen.findByRole('heading', { level: 1, name: 'Thu 31 Dec' })

    await user().click(screen.getByRole('button', { name: 'Next' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Fri 1 Jan' })).toBeInTheDocument()
    await waitFor(() => expect(requestedUrls(mock).at(-1)).toBe(calendarUrl('2027-01-01', '2027-01-01')))
  })

  it('switches views with the tabs, keeping the date', async () => {
    signIn()
    const mock = stubFetch()
    const router = renderAt('/admin/calendar?view=month&date=2026-10-07')
    const u = user()
    await screen.findAllByRole('listitem')
    expect(screen.getByRole('tab', { name: 'Month' })).toHaveAttribute('aria-selected', 'true')

    await u.click(screen.getByRole('tab', { name: 'Week' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Mon 5 Oct – Sun 11 Oct' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Week' })).toHaveAttribute('aria-selected', 'true')
    expect(router.state.location.search).toBe('?view=week&date=2026-10-07')

    await u.click(screen.getByRole('tab', { name: 'Day' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Wed 7 Oct' })).toBeInTheDocument()
    await waitFor(() =>
      expect(requestedUrls(mock)).toEqual([
        calendarUrl('2026-09-28', '2026-11-01'),
        calendarUrl('2026-10-05', '2026-10-11'),
        calendarUrl('2026-10-07', '2026-10-07'),
      ]),
    )
    expect(await screen.findAllByRole('listitem')).toHaveLength(2)
  })

  it('aborts the superseded request when the range changes, and shows only the new range', async () => {
    signIn()
    const mock = stubFetch((url) =>
      url === calendarUrl('2026-09-28', '2026-11-01') ? new Promise<Response>(() => {}) : json(EMPTY),
    )
    renderAt('/admin/calendar?view=month&date=2026-10-07')
    expect(await screen.findByRole('status')).toHaveTextContent('Loading calendar…')

    await user().click(screen.getByRole('button', { name: 'Next' }))

    await screen.findByRole('heading', { level: 1, name: 'November 2026' })
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
    expect(mock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true)
    expect(mock.mock.calls[1]?.[1]?.signal?.aborted).toBe(false)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

// --- Loading, failure, session ---------------------------------------------------------------

describe('loading and failure', () => {
  it('shows a loading status until the calendar arrives', async () => {
    signIn()
    let answer: (res: Response) => void = () => {}
    stubFetch(() => new Promise<Response>((resolve) => (answer = resolve)))
    renderAt('/admin/calendar?view=month&date=2026-10-07')

    expect(await screen.findByRole('status')).toHaveTextContent('Loading calendar…')
    expect(screen.queryAllByRole('listitem')).toEqual([])

    answer(json(OCTOBER))

    expect(await screen.findAllByRole('listitem')).toHaveLength(5)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it.each<[string, () => Response | Promise<Response>]>([
    ['a 500', () => json({ error: 'internal_error' }, 500)],
    ['a 422', () => json({ error: 'validation_failed', fields: ['to'] }, 422)],
    ['a network failure', () => Promise.reject(new TypeError('Failed to fetch'))],
  ])('on %s shows an error whose Try again refetches the same range', async (_label, fail) => {
    signIn()
    let calls = 0
    const mock = stubFetch(() => (++calls === 1 ? fail() : json(OCTOBER)))
    renderAt('/admin/calendar?view=month&date=2026-10-07')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Could not load the calendar.')
    expect(screen.queryAllByRole('listitem')).toEqual([])

    await user().click(within(alert).getByRole('button', { name: 'Try again' }))

    expect(await screen.findAllByRole('listitem')).toHaveLength(5)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(requestedUrls(mock)).toEqual([calendarUrl('2026-09-28', '2026-11-01'), calendarUrl('2026-09-28', '2026-11-01')])
    expect(readSession()).not.toBeNull()
  })

  it('on a 401 forgets the session and sends him to sign in', async () => {
    signIn()
    stubFetch(() => json({ error: 'unauthenticated' }, 401))
    const router = renderAt('/admin/calendar?view=month&date=2026-10-07')

    expect(await screen.findByRole('heading', { name: 'Admin sign in' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/admin/login')
    expect(readSession()).toBeNull()
  })
})

describe('the admin layout', () => {
  it.each<[string, () => void]>([
    ['no session', () => {}],
    ['an expired session', () => signIn(NOW.toISOString())],
  ])('with %s sends the visitor to sign in without requesting the calendar', async (_label, arrange) => {
    arrange()
    const mock = stubFetch()
    const router = renderAt('/admin/calendar?view=month&date=2026-10-07')

    expect(await screen.findByRole('heading', { name: 'Admin sign in' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/admin/login')
    expect(mock).not.toHaveBeenCalled()
  })

  it('opens the calendar from /admin', async () => {
    signIn()
    stubFetch(() => json(EMPTY))
    const router = renderAt('/admin')

    expect(await screen.findByRole('heading', { level: 1, name: 'November 2026' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/admin/calendar')
  })

  it('signs out by forgetting the session and returning to sign in', async () => {
    signIn()
    stubFetch()
    const router = renderAt('/admin/calendar?view=month&date=2026-10-07')
    await screen.findAllByRole('listitem')

    await user().click(screen.getByRole('button', { name: 'Sign out' }))

    expect(await screen.findByRole('heading', { name: 'Admin sign in' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/admin/login')
    expect(readSession()).toBeNull()
    expect(sessionStorage.getItem('bookly.admin.session')).toBeNull()
  })
})
