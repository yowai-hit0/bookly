import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/i18n'
import type { BookingListRow } from '@/admin/bookings'
import { readSession, saveSession } from '@/admin/session'
import { routes } from '@/routes'

/**
 * The bookings list (plan.md Task 19; spec §3.6), rendered through the real
 * routes with `fetch` stubbed.
 *
 * What is proven: every row shows its shoot in Kigali wall time whatever the
 * browser's own zone, its reference as a link into the booking, and the money
 * the API derived -- what is still owed, and what is owed back. The filter
 * lives in the URL, so a status toggle, a date or a search is bookmarkable and
 * survives a reload, and each change re-asks the API with exactly that filter.
 * "Load more" appends the page that follows the cursor rather than replacing
 * what is on screen or repeating it. A 401 sends him to sign in.
 */

const SESSION = { token: 'header.payload.signature', expiresAt: '2999-01-01T00:00:00.000Z' }
const BOOKINGS_API = '/api/admin/bookings'

const CONFIRMED: BookingListRow = {
  id: 'b1',
  reference: 'BKY-2701-00042',
  status: 'confirmed',
  // 09:00 to 10:30 Kigali on Wednesday 6 January 2027.
  startsAt: '2027-01-06T07:00:00.000Z',
  endsAt: '2027-01-06T08:30:00.000Z',
  contactName: 'Aline Uwase',
  contactEmail: 'aline@example.com',
  contactPhone: '+250788000000',
  serviceName: 'Portraits',
  packageName: 'Standard',
  grandTotalRwf: 50_000,
  collectedRwf: 20_000,
  outstandingRwf: 30_000,
  refundDueRwf: 0,
  hasRefundDue: false,
}

const CANCELLED: BookingListRow = {
  ...CONFIRMED,
  id: 'b2',
  reference: 'BKY-2701-00043',
  status: 'cancelled_by_admin',
  startsAt: '2027-01-05T12:00:00.000Z',
  endsAt: '2027-01-05T13:30:00.000Z',
  contactName: 'Eric Habimana',
  contactEmail: 'eric@example.com',
  grandTotalRwf: 40_000,
  collectedRwf: 0,
  outstandingRwf: 0,
  refundDueRwf: 16_000,
  hasRefundDue: true,
}

const NO_SHOW: BookingListRow = {
  ...CONFIRMED,
  id: 'b3',
  reference: 'BKY-2701-00044',
  status: 'no_show',
  startsAt: '2027-01-04T06:00:00.000Z',
  endsAt: '2027-01-04T07:30:00.000Z',
  contactName: 'Grace Mukamana',
  contactEmail: 'grace@example.com',
  outstandingRwf: 0,
  collectedRwf: 20_000,
  hasRefundDue: false,
}

const PAGE = { bookings: [CONFIRMED, CANCELLED, NO_SHOW], nextCursor: null }

type Handler = (url: string) => Response | Promise<Response>

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function stubFetch(handler: Handler = () => json(PAGE)) {
  const mock = vi.fn((input: string | URL | Request, _init?: RequestInit) =>
    Promise.resolve().then(() => handler(String(input))),
  )
  vi.stubGlobal('fetch', mock)
  return mock
}

function listCalls(mock: ReturnType<typeof stubFetch>): string[] {
  return mock.mock.calls.map(([input]) => String(input)).filter((url) => url.startsWith(BOOKINGS_API))
}

function signIn() {
  saveSession(SESSION)
}

function renderAt(path = '/admin/bookings') {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

function user() {
  return userEvent.setup({ delay: null })
}

/** Every body row of the table, once it has rendered. */
async function rows(): Promise<HTMLElement[]> {
  const table = await screen.findByRole('table')
  return within(table).getAllByRole('row').slice(1)
}

function references(bodyRows: HTMLElement[]): string[] {
  return bodyRows.map((row) => within(row).getByRole('link').textContent ?? '')
}

function statusButton(name: string): HTMLElement {
  return screen.getByRole('button', { name })
}

beforeEach(() => {
  signIn()
})

afterEach(() => {
  vi.unstubAllGlobals()
  sessionStorage.clear()
})

// --- Rendering ---------------------------------------------------------------------

describe('the list', () => {
  it('shows each shoot in Kigali wall time, its reference as a link, and the client', async () => {
    stubFetch()
    renderAt()

    const [first, second, third] = await rows()
    expect(screen.getByRole('heading', { level: 1, name: 'Bookings' })).toBeInTheDocument()
    expect(first).toHaveTextContent('Wednesday, 6 January 2027')
    expect(first).toHaveTextContent('09:00 – 10:30')
    expect(first).toHaveTextContent('Aline Uwase')
    expect(first).toHaveTextContent('aline@example.com')
    expect(first).toHaveTextContent('Portraits')
    expect(first).toHaveTextContent('Standard')
    expect(second).toHaveTextContent('Tuesday, 5 January 2027')
    expect(second).toHaveTextContent('14:00 – 15:30')
    expect(third).toHaveTextContent('Monday, 4 January 2027')
    expect(screen.getByRole('link', { name: 'BKY-2701-00042' })).toHaveAttribute('href', '/admin/bookings/b1')
    expect(screen.getByRole('link', { name: 'BKY-2701-00043' })).toHaveAttribute('href', '/admin/bookings/b2')
  })

  it('names each status in words', async () => {
    stubFetch()
    renderAt()

    const [first, second, third] = await rows()
    expect(first).toHaveTextContent('Confirmed')
    expect(second).toHaveTextContent('Cancelled by you')
    expect(third).toHaveTextContent('No-show')
  })

  it('shows the total, what is still owed, and what is owed back', async () => {
    stubFetch()
    renderAt()

    const [first, second, third] = await rows()
    expect(first).toHaveTextContent('50,000 RWF')
    expect(first).toHaveTextContent('30,000 RWF still to pay')
    expect(first).not.toHaveTextContent('to refund')
    expect(second).toHaveTextContent('16,000 RWF to refund')
    expect(second).not.toHaveTextContent('still to pay')
    // A no-show owes nothing, which is the bug the v2.0 view would have shown.
    expect(third).not.toHaveTextContent('still to pay')
  })

  it('asks the API once, for the unfiltered list', async () => {
    const mock = stubFetch()
    renderAt()

    await rows()

    expect(listCalls(mock)).toEqual([BOOKINGS_API])
  })

  it('says it is loading until the page arrives', async () => {
    let answer: (response: Response) => void = () => {}
    stubFetch(() => new Promise<Response>((resolve) => (answer = resolve)))
    renderAt()

    expect(await screen.findByRole('status')).toHaveTextContent(/Loading/)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()

    answer(json(PAGE))

    await rows()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('says so when nothing matches', async () => {
    stubFetch(() => json({ bookings: [], nextCursor: null }))
    renderAt()

    expect(await screen.findByText('No bookings match these filters.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows an error when the API does not answer', async () => {
    stubFetch(() => json({ error: 'internal_error' }, 500))
    renderAt()

    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load the bookings.')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('sends him to sign in on a 401 and forgets the token', async () => {
    stubFetch(() => json({ error: 'unauthenticated' }, 401))
    renderAt()

    expect(await screen.findByRole('heading', { name: 'Admin sign in' })).toBeInTheDocument()
    expect(readSession()).toBeNull()
  })
})

// --- The filter, which lives in the URL ------------------------------------------------

describe('filtering', () => {
  it('toggles a status into the URL, presses the button, and re-asks with it', async () => {
    const mock = stubFetch()
    const router = renderAt()
    await rows()

    await user().click(statusButton('Confirmed'))

    await waitFor(() => expect(listCalls(mock)).toHaveLength(2))
    expect(router.state.location.search).toBe('?status=confirmed')
    expect(listCalls(mock)[1]).toBe(`${BOOKINGS_API}?status=confirmed`)
    expect(statusButton('Confirmed')).toHaveAttribute('aria-pressed', 'true')
    expect(statusButton('Completed')).toHaveAttribute('aria-pressed', 'false')
  })

  it('toggles a status back off', async () => {
    const mock = stubFetch()
    const router = renderAt('/admin/bookings?status=confirmed')
    await rows()
    expect(statusButton('Confirmed')).toHaveAttribute('aria-pressed', 'true')

    await user().click(statusButton('Confirmed'))

    await waitFor(() => expect(router.state.location.search).toBe(''))
    expect(listCalls(mock).at(-1)).toBe(BOOKINGS_API)
    expect(statusButton('Confirmed')).toHaveAttribute('aria-pressed', 'false')
  })

  it('keeps several statuses at once, repeated in the query', async () => {
    const mock = stubFetch()
    const router = renderAt('/admin/bookings?status=confirmed')
    await rows()

    await user().click(statusButton('No-show'))

    await waitFor(() => expect(listCalls(mock)).toHaveLength(2))
    expect(router.state.location.search).toBe('?status=confirmed&status=no_show')
    expect(listCalls(mock)[1]).toBe(`${BOOKINGS_API}?status=confirmed&status=no_show`)
  })

  it('reads the whole filter out of the URL on first render', async () => {
    const mock = stubFetch()
    renderAt('/admin/bookings?status=confirmed&status=completed&from=2027-01-01&to=2027-01-31&search=Uwase')
    await rows()

    expect(listCalls(mock)).toEqual([
      `${BOOKINGS_API}?status=confirmed&status=completed&from=2027-01-01&to=2027-01-31&search=Uwase`,
    ])
    expect(statusButton('Confirmed')).toHaveAttribute('aria-pressed', 'true')
    expect(statusButton('Completed')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('From')).toHaveValue('2027-01-01')
    expect(screen.getByLabelText('To')).toHaveValue('2027-01-31')
    expect(screen.getByLabelText('Search')).toHaveValue('Uwase')
  })

  it('ignores a status in the URL that is not one of ours', async () => {
    const mock = stubFetch()
    renderAt('/admin/bookings?status=declined')
    await rows()

    expect(listCalls(mock)).toEqual([BOOKINGS_API])
  })

  it('writes a from date into the URL and re-asks', async () => {
    const mock = stubFetch()
    const router = renderAt()
    await rows()

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2027-01-01' } })

    await waitFor(() => expect(listCalls(mock)).toHaveLength(2))
    expect(router.state.location.search).toBe('?from=2027-01-01')
    expect(listCalls(mock)[1]).toBe(`${BOOKINGS_API}?from=2027-01-01`)
  })

  it('writes a to date beside it, keeping the from date', async () => {
    const mock = stubFetch()
    const router = renderAt('/admin/bookings?from=2027-01-01')
    await rows()

    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2027-01-31' } })

    await waitFor(() => expect(listCalls(mock)).toHaveLength(2))
    expect(router.state.location.search).toBe('?from=2027-01-01&to=2027-01-31')
  })

  it('searches on submit, trimming what was typed, and keeps the status filter', async () => {
    const mock = stubFetch()
    const router = renderAt('/admin/bookings?status=confirmed')
    await rows()

    await user().type(screen.getByLabelText('Search'), '  Uwase  ')
    await user().click(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() => expect(listCalls(mock)).toHaveLength(2))
    expect(router.state.location.search).toBe('?status=confirmed&search=Uwase')
    expect(listCalls(mock)[1]).toBe(`${BOOKINGS_API}?status=confirmed&search=Uwase`)
  })

  it('clears every filter at once', async () => {
    const mock = stubFetch()
    const router = renderAt('/admin/bookings?status=confirmed&from=2027-01-01&search=Uwase')
    await rows()

    await user().click(screen.getByRole('button', { name: 'Clear filters' }))

    await waitFor(() => expect(router.state.location.search).toBe(''))
    expect(listCalls(mock).at(-1)).toBe(BOOKINGS_API)
    expect(statusButton('Confirmed')).toHaveAttribute('aria-pressed', 'false')
  })

  it('offers nothing to clear when nothing is filtered', async () => {
    stubFetch()
    renderAt()
    await rows()

    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument()
  })
})

// --- Paging -------------------------------------------------------------------------

describe('load more', () => {
  const MORE: BookingListRow = { ...CONFIRMED, id: 'b4', reference: 'BKY-2701-00045', startsAt: '2027-01-03T07:00:00.000Z', endsAt: '2027-01-03T08:30:00.000Z' }

  /** Page 1 holds the three fixtures and a cursor; page 2 holds one more and none. */
  function paged(): ReturnType<typeof stubFetch> {
    return stubFetch((url) =>
      url.includes('cursor=')
        ? json({ bookings: [MORE], nextCursor: null })
        : json({ bookings: [CONFIRMED, CANCELLED, NO_SHOW], nextCursor: 'bmV4dA' }),
    )
  }

  it('appends the next page without repeating what is already shown', async () => {
    const mock = paged()
    renderAt()
    expect(references(await rows())).toEqual(['BKY-2701-00042', 'BKY-2701-00043', 'BKY-2701-00044'])

    await user().click(screen.getByRole('button', { name: 'Load more' }))

    await waitFor(async () => expect(await rows()).toHaveLength(4))
    const shown = references(await rows())
    expect(shown).toEqual(['BKY-2701-00042', 'BKY-2701-00043', 'BKY-2701-00044', 'BKY-2701-00045'])
    expect(new Set(shown).size).toBe(shown.length)
    expect(listCalls(mock)[1]).toBe(`${BOOKINGS_API}?cursor=bmV4dA`)
  })

  it('carries the filter into the next page', async () => {
    const mock = paged()
    renderAt('/admin/bookings?status=confirmed&search=Uwase')
    await rows()

    await user().click(screen.getByRole('button', { name: 'Load more' }))

    await waitFor(() => expect(listCalls(mock)).toHaveLength(2))
    expect(listCalls(mock)[1]).toBe(`${BOOKINGS_API}?status=confirmed&search=Uwase&cursor=bmV4dA`)
  })

  it('stops offering more once the cursor comes back null', async () => {
    paged()
    renderAt()
    await rows()

    await user().click(screen.getByRole('button', { name: 'Load more' }))

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument())
  })

  it('offers nothing more when the first page is the whole list', async () => {
    stubFetch()
    renderAt()
    await rows()

    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
  })

  it('sends him to sign in when the next page answers 401', async () => {
    let first = true
    stubFetch(() => {
      if (first) {
        first = false
        return json({ bookings: [CONFIRMED], nextCursor: 'bmV4dA' })
      }
      return json({ error: 'unauthenticated' }, 401)
    })
    renderAt()
    await rows()

    await user().click(screen.getByRole('button', { name: 'Load more' }))

    expect(await screen.findByRole('heading', { name: 'Admin sign in' })).toBeInTheDocument()
    expect(readSession()).toBeNull()
  })
})
