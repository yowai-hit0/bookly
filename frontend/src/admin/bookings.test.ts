import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, UnauthenticatedError } from './api'
import { type AdminBooking, BOOKING_STATUSES, bookingsApi } from './bookings'
import { readSession, saveSession } from './session'

/**
 * The bookings API client (plan.md Task 19; spec §3.6, §6.11, §6.12, §6.16,
 * §6.21).
 *
 * What is proven: the list's filter becomes the query string the API takes --
 * `status` repeated rather than joined, empty values left out entirely, and no
 * `?` at all when there is nothing to ask for -- every action is a POST with a
 * JSON body and the bearer token, and a 401 surfaces as `UnauthenticatedError`
 * with the stored session dropped, while any other refusal keeps the API's own
 * error code so the screen can map it to words.
 */

const SESSION = { token: 'header.payload.signature', expiresAt: '2999-01-01T00:00:00.000Z' }
const BOOKING_ID = 'b1a7c2d4-0000-4000-8000-000000000001'
const PAYMENT_ID = 'c2b8d3e5-0000-4000-8000-000000000002'

const BOOKING = {
  id: BOOKING_ID,
  reference: 'BKY-2701-00042',
  status: 'confirmed',
  locale: 'en',
  client: { id: 'cl1', fullName: 'Aline Uwase', email: 'aline@example.com', phone: '+250788000000', anonymized: false },
  contact: { name: 'Aline Uwase', email: 'aline@example.com', phone: '+250788000000' },
  service: { id: 's1', name: 'Portraits' },
  package: { id: 'p1', name: 'Standard', priceRwf: 40_000, durationMinutes: 90, photoCount: 25 },
  schedule: {
    startsAt: '2027-01-06T07:00:00.000Z',
    endsAt: '2027-01-06T08:30:00.000Z',
    bufferEndsAt: '2027-01-06T09:00:00.000Z',
    holdExpiresAt: null,
    originalStartsAt: null,
    rescheduledAt: null,
  },
  details: { locationText: 'Kigali Heights', partySize: 3, specialRequests: null, consentAt: '2026-10-01T06:00:00.000Z' },
  addons: [],
  money: {
    bookingFeeRate: 0.4,
    bookingFeeRwf: 16_000,
    totals: { quotedTotalRwf: 40_000, grandTotalRwf: 40_000, collectedRwf: 16_000, refundDueRwf: 0, outstandingRwf: 24_000 },
  },
  payments: [],
  lifecycle: { confirmedAt: '2026-10-01T06:05:00.000Z', completedAt: null, cancelledAt: null, cancellationReason: null },
  access: { hasLink: true, expiresAt: '2027-10-01T06:05:00.000Z', lastUsedAt: null },
  delivery: { url: null, expiresOn: null, sentAt: null, note: null },
  messages: [],
  actions: { canReschedule: true, canCancel: true, canComplete: false, canMarkNoShow: false, canResendLink: true, canEditAddons: false, canRequestSessionFee: false },
} satisfies AdminBooking

type FetchArgs = [input: string | URL | Request, init?: RequestInit]

function stubFetch(respond: () => Response | Promise<Response> = () => json({ booking: BOOKING })) {
  const mock = vi.fn(async (..._args: FetchArgs) => respond())
  vi.stubGlobal('fetch', mock)
  return mock
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

/** The one call's URL, method, headers and parsed body. */
function sent(mock: ReturnType<typeof stubFetch>) {
  expect(mock).toHaveBeenCalledTimes(1)
  const [input, init = {}] = mock.mock.calls[0] ?? []
  return {
    url: String(input),
    method: init.method ?? 'GET',
    headers: new Headers(init.headers),
    body: typeof init.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
  }
}

async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('Expected the promise to reject')
}

beforeEach(() => {
  saveSession(SESSION)
})

afterEach(() => {
  vi.unstubAllGlobals()
  sessionStorage.clear()
})

// --- The list's query string -----------------------------------------------------

describe('bookingsApi.list', () => {
  it('asks for the bare path when there is nothing to filter by', async () => {
    const mock = stubFetch(() => json({ bookings: [], nextCursor: null }))

    await bookingsApi.list()

    expect(sent(mock).url).toBe('/api/admin/bookings')
  })

  it('repeats status rather than joining it, in the order given', async () => {
    const mock = stubFetch(() => json({ bookings: [], nextCursor: null }))

    await bookingsApi.list({ statuses: ['confirmed', 'no_show', 'cancelled_by_admin'] })

    expect(sent(mock).url).toBe('/api/admin/bookings?status=confirmed&status=no_show&status=cancelled_by_admin')
  })

  it('sends every status the API knows, unchanged', async () => {
    const mock = stubFetch(() => json({ bookings: [], nextCursor: null }))

    await bookingsApi.list({ statuses: BOOKING_STATUSES })

    const url = new URL(sent(mock).url, 'https://admin.example')
    expect(url.searchParams.getAll('status')).toEqual([...BOOKING_STATUSES])
  })

  it('carries the dates, the search, the cursor and the limit', async () => {
    const mock = stubFetch(() => json({ bookings: [], nextCursor: null }))

    await bookingsApi.list({ from: '2027-01-01', to: '2027-01-31', search: 'Uwase', cursor: 'Y3Vyc29y', limit: 50 })

    expect(sent(mock).url).toBe('/api/admin/bookings?from=2027-01-01&to=2027-01-31&search=Uwase&cursor=Y3Vyc29y&limit=50')
  })

  it('leaves out anything empty or absent', async () => {
    const mock = stubFetch(() => json({ bookings: [], nextCursor: null }))

    await bookingsApi.list({ statuses: [], from: '', to: '', search: '', cursor: '' })

    expect(sent(mock).url).toBe('/api/admin/bookings')
  })

  it('escapes what it is given rather than pasting it into the URL', async () => {
    const mock = stubFetch(() => json({ bookings: [], nextCursor: null }))

    await bookingsApi.list({ search: 'a&b=c d+e' })

    const url = new URL(sent(mock).url, 'https://admin.example')
    expect(url.searchParams.get('search')).toBe('a&b=c d+e')
    expect(sent(mock).url).not.toContain('a&b=c')
  })

  it('answers the page the API sent, cursor included', async () => {
    const page = { bookings: [{ id: BOOKING_ID, reference: 'BKY-2701-00042' }], nextCursor: 'bmV4dA' }
    stubFetch(() => json(page))

    expect(await bookingsApi.list()).toEqual(page)
  })

  it('sends the bearer token and asks for JSON, with no body to post', async () => {
    const mock = stubFetch(() => json({ bookings: [], nextCursor: null }))

    await bookingsApi.list()

    const call = sent(mock)
    expect(call.method).toBe('GET')
    expect(call.headers.get('Authorization')).toBe(`Bearer ${SESSION.token}`)
    expect(call.headers.get('Accept')).toBe('application/json')
    expect(call.headers.has('Content-Type')).toBe(false)
    expect(call.body).toBeUndefined()
  })
})

// --- One booking, and every action ------------------------------------------------

describe('every call’s method, path and body', () => {
  type Call = [label: string, run: () => Promise<unknown>, method: string, url: string, body: unknown]

  it.each<Call>([
    ['get', () => bookingsApi.get(BOOKING_ID), 'GET', `/api/admin/bookings/${BOOKING_ID}`, undefined],
    [
      'reschedule',
      () => bookingsApi.reschedule(BOOKING_ID, '2027-01-07T09:00:00+02:00'),
      'POST',
      `/api/admin/bookings/${BOOKING_ID}/reschedule`,
      { startsAt: '2027-01-07T09:00:00+02:00' },
    ],
    ['cancel with a reason', () => bookingsApi.cancel(BOOKING_ID, 'Studio flooded.'), 'POST', `/api/admin/bookings/${BOOKING_ID}/cancel`, { reason: 'Studio flooded.' }],
    ['cancel with none', () => bookingsApi.cancel(BOOKING_ID, null), 'POST', `/api/admin/bookings/${BOOKING_ID}/cancel`, { reason: null }],
    ['complete', () => bookingsApi.complete(BOOKING_ID), 'POST', `/api/admin/bookings/${BOOKING_ID}/complete`, {}],
    ['markNoShow', () => bookingsApi.markNoShow(BOOKING_ID), 'POST', `/api/admin/bookings/${BOOKING_ID}/no-show`, {}],
    ['resendLink', () => bookingsApi.resendLink(BOOKING_ID), 'POST', `/api/admin/bookings/${BOOKING_ID}/resend-link`, {}],
    [
      'recordRefund',
      () => bookingsApi.recordRefund(PAYMENT_ID, 'MOMO-REF-7781'),
      'POST',
      `/api/admin/payments/${PAYMENT_ID}/refund`,
      { reference: 'MOMO-REF-7781' },
    ],
  ])('%s', async (_label, run, method, url, body) => {
    const mock = stubFetch()

    await run()

    const call = sent(mock)
    expect([call.url, call.method]).toEqual([url, method])
    expect(call.headers.get('Authorization')).toBe(`Bearer ${SESSION.token}`)
    if (body === undefined) {
      expect(call.body).toBeUndefined()
      expect(call.headers.has('Content-Type')).toBe(false)
    } else {
      expect(call.body).toEqual(body)
      expect(call.headers.get('Content-Type')).toBe('application/json')
    }
  })

  it('answers the parsed booking every action returns', async () => {
    stubFetch()

    expect(await bookingsApi.get(BOOKING_ID)).toEqual({ booking: BOOKING })
    vi.unstubAllGlobals()
    stubFetch()
    expect((await bookingsApi.complete(BOOKING_ID)).booking.actions.canResendLink).toBe(true)
  })
})

// --- Refusals ----------------------------------------------------------------------

describe('when the API refuses', () => {
  it.each([
    ['list', () => bookingsApi.list()],
    ['get', () => bookingsApi.get(BOOKING_ID)],
    ['cancel', () => bookingsApi.cancel(BOOKING_ID, null)],
    ['recordRefund', () => bookingsApi.recordRefund(PAYMENT_ID, 'MOMO-1')],
  ])('surfaces a 401 from %s as UnauthenticatedError and forgets the token', async (_label, run) => {
    stubFetch(() => json({ error: 'unauthenticated' }, 401))

    const error = await rejectionOf(run())

    expect(error).toBeInstanceOf(UnauthenticatedError)
    expect(readSession()).toBeNull()
  })

  it('throws UnauthenticatedError without asking the network when there is no session', async () => {
    sessionStorage.clear()
    const mock = stubFetch()

    expect(await rejectionOf(bookingsApi.list())).toBeInstanceOf(UnauthenticatedError)
    expect(mock).not.toHaveBeenCalled()
  })

  it.each([
    ['slot_taken', 409],
    ['unchanged', 409],
    ['not_allowed', 409],
    ['not_refundable', 409],
    ['not_found', 404],
    ['invalid_request', 400],
  ])('keeps the API’s own %s code, with its status', async (code, status) => {
    stubFetch(() => json({ error: code, booking: BOOKING }, status))

    const error = await rejectionOf(bookingsApi.reschedule(BOOKING_ID, '2027-01-07T09:00:00+02:00'))

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ message: code, status })
    expect(readSession()).not.toBeNull()
  })

  it('names the fields a 422 rejects', async () => {
    stubFetch(() => json({ error: 'validation_failed', fields: ['reason'] }, 422))

    const error = await rejectionOf(bookingsApi.cancel(BOOKING_ID, 'x'))

    expect(error).toMatchObject({ message: 'validation_failed', status: 422, fields: ['reason'] })
  })

  it('falls back to the status when the body is not the API’s error shape', async () => {
    stubFetch(() => new Response('<html>gateway</html>', { status: 502 }))

    expect(await rejectionOf(bookingsApi.list())).toMatchObject({ message: 'http_502', status: 502 })
  })
})
