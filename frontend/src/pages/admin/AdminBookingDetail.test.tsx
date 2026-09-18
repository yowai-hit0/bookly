import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/i18n'
import type { AdminBooking, AdminPayment } from '@/admin/bookings'
import { readSession, saveSession } from '@/admin/session'
import { routes } from '@/routes'

/**
 * One booking and everything the photographer does to it (plan.md Task 19;
 * spec §3.6, §6.11, §6.12, §6.16, §6.21), rendered through the real routes
 * with `fetch` stubbed.
 *
 * What is proven: every section renders from what the API sent -- the shoot,
 * the client, the money `bookingTotals()` derived, each payment attempt and
 * every message the booking has sent; the buttons follow the API's own
 * `actions` flags rather than guessing; the reschedule field is Kigali wall
 * time whatever zone the browser is in (spec §6.5) and submits it with the
 * `+02:00` that makes it unambiguous; cancelling asks twice and carries the
 * reason; and every action re-renders from the booking the API answered with.
 *
 * A refusal is the interesting case. A 409 shows the mapped words -- "that time
 * is already taken", not "something went wrong" -- and the screen catches up
 * with whatever changed underneath it instead of staying stale.
 */

const SESSION = { token: 'header.payload.signature', expiresAt: '2999-01-01T00:00:00.000Z' }
const BOOKING_ID = 'b1a7c2d4-0000-4000-8000-000000000001'
const PAYMENT_ID = 'c2b8d3e5-0000-4000-8000-000000000002'
const DETAIL_PATH = `/admin/bookings/${BOOKING_ID}`
const DETAIL_API = `/api/admin/bookings/${BOOKING_ID}`

const BOOKING_FEE: AdminPayment = {
  id: PAYMENT_ID,
  kind: 'booking_fee',
  provider: 'mtn_momo_direct',
  ourRef: 'a1b2c3d4',
  providerRef: '4100000123',
  method: 'momo_mtn',
  amountRwf: 20_000,
  status: 'succeeded',
  failureReason: null,
  initiatedAt: '2026-10-01T06:00:00.000Z',
  settledAt: '2026-10-01T06:05:00.000Z',
  refundedAt: null,
  refundReference: null,
  canRecordRefund: false,
}

const BOOKING: AdminBooking = {
  id: BOOKING_ID,
  reference: 'BKY-2701-00042',
  status: 'confirmed',
  locale: 'en',
  client: { id: 'cl1', fullName: 'Aline Uwase', email: 'aline@example.com', phone: '+250788000000', anonymized: false },
  contact: { name: 'Aline Uwase', email: 'aline@example.com', phone: '+250788000000' },
  service: { id: 's1', name: 'Portraits' },
  package: { id: 'p1', name: 'Standard', priceRwf: 40_000, durationMinutes: 90, photoCount: 25 },
  schedule: {
    // 09:00 to 10:30 Kigali on Wednesday 6 January 2027.
    startsAt: '2027-01-06T07:00:00.000Z',
    endsAt: '2027-01-06T08:30:00.000Z',
    bufferEndsAt: '2027-01-06T09:00:00.000Z',
    holdExpiresAt: null,
    originalStartsAt: null,
    rescheduledAt: null,
  },
  details: {
    locationText: 'Kigali Heights, KG 7 Ave',
    partySize: 3,
    specialRequests: 'Golden hour if possible.',
    consentAt: '2026-10-01T06:00:00.000Z',
  },
  addons: [{ id: 'ba1', name: 'Extra hour', unitPriceRwf: 10_000, quantity: 1, amountRwf: 10_000, stage: 'at_booking', canRemove: false }],
  money: {
    bookingFeeRate: 0.4,
    bookingFeeRwf: 20_000,
    totals: { quotedTotalRwf: 50_000, grandTotalRwf: 50_000, collectedRwf: 20_000, refundDueRwf: 0, outstandingRwf: 30_000 },
  },
  payments: [BOOKING_FEE],
  lifecycle: { confirmedAt: '2026-10-01T06:05:00.000Z', completedAt: null, cancelledAt: null, cancellationReason: null },
  access: { hasLink: true, expiresAt: '2027-10-01T06:05:00.000Z', lastUsedAt: null },
  delivery: { url: null, expiresOn: null, sentAt: null, note: null },
  messages: [
    {
      id: 'm1',
      kind: 'email',
      template: 'booking_confirmation',
      recipient: 'aline@example.com',
      status: 'done',
      attempts: 1,
      lastError: null,
      createdAt: '2026-10-01T06:05:00.000Z',
      completedAt: '2026-10-01T06:05:30.000Z',
    },
  ],
  actions: { canReschedule: true, canCancel: true, canComplete: false, canMarkNoShow: false, canResendLink: true, canEditAddons: false, canRequestSessionFee: false },
}

/** The same booking with a shoot that has begun: every action is open. */
const STARTED: AdminBooking = {
  ...BOOKING,
  actions: { canReschedule: true, canCancel: true, canComplete: true, canMarkNoShow: true, canResendLink: true, canEditAddons: false, canRequestSessionFee: false },
}

const CANCELLED: AdminBooking = {
  ...BOOKING,
  status: 'cancelled_by_admin',
  lifecycle: { ...BOOKING.lifecycle, cancelledAt: '2026-10-02T09:00:00.000Z', cancellationReason: 'Studio flooded.' },
  money: { ...BOOKING.money, totals: { ...BOOKING.money.totals, collectedRwf: 0, refundDueRwf: 20_000, outstandingRwf: 0 } },
  payments: [{ ...BOOKING_FEE, status: 'refund_due', canRecordRefund: true }],
  actions: { canReschedule: false, canCancel: false, canComplete: false, canMarkNoShow: false, canResendLink: true, canEditAddons: false, canRequestSessionFee: false },
}

type Sent = { method: string; url: string; body: unknown }

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

/**
 * A `fetch` for the admin API: GET answers whatever `current.value` holds, and
 * every POST goes to `onPost`, which by default answers the same booking back.
 */
function stubApi(options: { booking?: AdminBooking; onPost?: (call: Sent, current: { value: AdminBooking }) => Response } = {}) {
  const current = { value: options.booking ?? BOOKING }
  const sent: Sent[] = []
  const mock = vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
    const call: Sent = {
      method: init.method ?? 'GET',
      url: String(input),
      body: typeof init.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
    }
    sent.push(call)
    if (call.method === 'GET') return json({ booking: current.value })
    return options.onPost === undefined ? json({ booking: current.value }) : options.onPost(call, current)
  })
  vi.stubGlobal('fetch', mock)
  return { sent, current }
}

function writes(sent: Sent[]): Sent[] {
  return sent.filter((call) => call.method !== 'GET')
}

function gets(sent: Sent[]): Sent[] {
  return sent.filter((call) => call.method === 'GET')
}

function signIn() {
  saveSession(SESSION)
}

function renderAt(path = DETAIL_PATH) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

function user() {
  return userEvent.setup({ delay: null })
}

/** Renders the page and waits for the booking to arrive. */
async function renderLoaded(path = DETAIL_PATH) {
  const router = renderAt(path)
  await screen.findByRole('heading', { level: 1 })
  return router
}

function section(title: string): HTMLElement {
  const heading = screen.getByRole('heading', { level: 2, name: title })
  const element = heading.closest('section')
  if (element === null) throw new Error(`No section titled ${title}`)
  return element
}

beforeEach(() => {
  signIn()
})

afterEach(() => {
  vi.unstubAllGlobals()
  sessionStorage.clear()
})

// --- Rendering ------------------------------------------------------------------------

describe('the booking', () => {
  it('heads the page with the reference and the status in words', async () => {
    stubApi()
    await renderLoaded()

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('BKY-2701-00042')
    expect(screen.getByRole('link', { name: /All bookings/ })).toHaveAttribute('href', '/admin/bookings')
    expect(document.body).toHaveTextContent('Confirmed')
  })

  it('shows the shoot in Kigali wall time, with the location and what was asked for', async () => {
    stubApi()
    await renderLoaded()

    const shoot = section('The shoot')
    expect(shoot).toHaveTextContent('Wednesday, 6 January 2027, 09:00 – 10:30')
    expect(shoot).toHaveTextContent('Portraits, Standard')
    expect(shoot).toHaveTextContent('Kigali Heights, KG 7 Ave')
    expect(shoot).toHaveTextContent('Number of people3')
    expect(shoot).toHaveTextContent('Golden hour if possible.')
    expect(shoot).not.toHaveTextContent('Originally booked for')
    expect(shoot).not.toHaveTextContent('Reason given')
  })

  it('shows where the booking was moved from once it has been moved', async () => {
    stubApi({
      booking: {
        ...BOOKING,
        schedule: { ...BOOKING.schedule, originalStartsAt: '2027-01-04T06:00:00.000Z', rescheduledAt: '2026-10-02T09:00:00.000Z' },
      },
    })
    await renderLoaded()

    const shoot = section('The shoot')
    expect(shoot).toHaveTextContent('Originally booked for')
    expect(shoot).toHaveTextContent('4 Jan 2027, 08:00')
    expect(shoot).toHaveTextContent('Last moved')
  })

  it('shows the reason when the booking was cancelled', async () => {
    stubApi({ booking: CANCELLED })
    await renderLoaded()

    expect(section('The shoot')).toHaveTextContent('Reason givenStudio flooded.')
  })

  it('shows the client and whether their link is live', async () => {
    stubApi()
    await renderLoaded()

    const client = section('Client')
    expect(client).toHaveTextContent('Aline Uwase')
    expect(client).toHaveTextContent('aline@example.com')
    expect(client).toHaveTextContent('+250788000000')
    expect(client).toHaveTextContent(/Live until/)
  })

  it('says when no link has been issued', async () => {
    stubApi({ booking: { ...BOOKING, access: { hasLink: false, expiresAt: null, lastUsedAt: null } } })
    await renderLoaded()

    expect(section('Client')).toHaveTextContent('Not issued yet')
  })

  it('shows the money the API derived, line by line', async () => {
    stubApi()
    await renderLoaded()

    const money = section('Money')
    expect(money).toHaveTextContent('Standard40,000 RWF')
    expect(money).toHaveTextContent('Extra hour10,000 RWF')
    expect(money).toHaveTextContent('Total50,000 RWF')
    expect(money).toHaveTextContent('Collected20,000 RWF')
    expect(money).toHaveTextContent('Still to pay30,000 RWF')
    expect(money).not.toHaveTextContent('To refund')
  })

  it('shows what is owed back once there is any', async () => {
    stubApi({ booking: CANCELLED })
    await renderLoaded()

    expect(section('Money')).toHaveTextContent('To refund20,000 RWF')
    expect(section('Money')).toHaveTextContent('Still to pay0 RWF')
  })

  it('marks a post-shoot add-on as added after the shoot', async () => {
    stubApi({
      booking: {
        ...BOOKING,
        addons: [
          ...BOOKING.addons,
          { id: 'ba2', name: 'Rush edit', unitPriceRwf: 15_000, quantity: 1, amountRwf: 15_000, stage: 'post_shoot', canRemove: false },
        ],
      },
    })
    await renderLoaded()

    expect(section('Money')).toHaveTextContent('Rush edit (added after the shoot)15,000 RWF')
  })

  it('lists every payment attempt with its references', async () => {
    stubApi()
    await renderLoaded()

    const payments = section('Payments')
    expect(payments).toHaveTextContent('Booking fee')
    expect(payments).toHaveTextContent('20,000 RWF')
    expect(payments).toHaveTextContent('Paid')
    expect(payments).toHaveTextContent('mtn_momo_direct')
    expect(payments).toHaveTextContent('a1b2c3d4')
    expect(payments).toHaveTextContent('4100000123')
    expect(within(payments).queryByLabelText('Refund reference')).not.toBeInTheDocument()
  })

  it('says so when there are no payments and no messages yet', async () => {
    stubApi({ booking: { ...BOOKING, payments: [], messages: [] } })
    await renderLoaded()

    expect(section('Payments')).toHaveTextContent('No payments yet.')
    expect(section('Messages sent')).toHaveTextContent('Nothing sent yet.')
  })

  it('lists the messages the booking has sent, named in words', async () => {
    stubApi()
    await renderLoaded()

    const messages = section('Messages sent')
    expect(messages).toHaveTextContent('Booking confirmation')
    expect(messages).toHaveTextContent('Sent')
    expect(messages).toHaveTextContent('1 Oct 2026, 08:05')
  })

  it('shows a message that failed, with the error', async () => {
    stubApi({
      booking: {
        ...BOOKING,
        messages: [{ ...BOOKING.messages[0], id: 'm2', status: 'failed', attempts: 8, lastError: 'SMTP 550' } as AdminBooking['messages'][number]],
      },
    })
    await renderLoaded()

    expect(section('Messages sent')).toHaveTextContent('Failed · SMTP 550')
  })
})

// --- Loading and failing --------------------------------------------------------------

describe('before the booking arrives', () => {
  it('says it is loading', async () => {
    stubApi()
    renderAt()

    expect(await screen.findByRole('status')).toHaveTextContent(/Loading/)
  })

  it('says the booking no longer exists on a 404', async () => {
    const mock = vi.fn(async () => json({ error: 'not_found' }, 404))
    vi.stubGlobal('fetch', mock)
    renderAt()

    expect(await screen.findByRole('heading', { level: 1, name: 'This booking no longer exists' })).toBeInTheDocument()
  })

  /**
   * FAILING, and left failing deliberately: `AdminBookingDetail.tsx:93` tests
   * `state === 'missing' || booking === null` before `state === 'failed'` at
   * line 100. A load that fails for any reason other than 404 leaves `booking`
   * null, so it takes the first branch and the photographer is told the booking
   * no longer exists -- when the API merely 500ed, or the connection dropped.
   * The `admin:booking.loadFailed` copy is unreachable on a first load.
   */
  it('shows an error on anything else, rather than claiming the booking is gone', async () => {
    const mock = vi.fn(async () => json({ error: 'internal_error' }, 500))
    vi.stubGlobal('fetch', mock)
    renderAt()

    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load this booking.')
    expect(screen.queryByRole('heading', { name: 'This booking no longer exists' })).not.toBeInTheDocument()
  })

  it('sends him to sign in on a 401 and forgets the token', async () => {
    const mock = vi.fn(async () => json({ error: 'unauthenticated' }, 401))
    vi.stubGlobal('fetch', mock)
    renderAt()

    expect(await screen.findByRole('heading', { name: 'Admin sign in' })).toBeInTheDocument()
    expect(readSession()).toBeNull()
  })
})

// --- What the actions flags allow ------------------------------------------------------

describe('the buttons follow the API’s actions flags', () => {
  it('offers reschedule, cancel and a new link on a confirmed booking before its shoot', async () => {
    stubApi()
    await renderLoaded()

    expect(screen.getByRole('button', { name: 'Move booking' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel this booking' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send a new booking link' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mark completed' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mark no-show' })).not.toBeInTheDocument()
  })

  it('offers completed and no-show once the shoot has begun', async () => {
    stubApi({ booking: STARTED })
    await renderLoaded()

    expect(screen.getByRole('button', { name: 'Mark completed' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mark no-show' })).toBeInTheDocument()
  })

  it('offers nothing but a new link once the booking is cancelled', async () => {
    stubApi({ booking: CANCELLED })
    await renderLoaded()

    for (const name of ['Move booking', 'Cancel this booking', 'Mark completed', 'Mark no-show']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: 'Send a new booking link' })).toBeInTheDocument()
  })

  it('offers no link at all when the booking never had one', async () => {
    stubApi({ booking: { ...BOOKING, actions: { ...BOOKING.actions, canResendLink: false } } })
    await renderLoaded()

    expect(screen.queryByRole('button', { name: 'Send a new booking link' })).not.toBeInTheDocument()
  })
})

// --- Rescheduling ----------------------------------------------------------------------

describe('the reschedule field', () => {
  it('opens on the booking’s own Kigali wall time', async () => {
    stubApi()
    await renderLoaded()

    expect(screen.getByLabelText('New start (Kigali time)')).toHaveValue('2027-01-06T09:00')
  })

  it('submits the chosen time with Kigali’s offset, so the API cannot read it as anything else', async () => {
    const { sent } = stubApi()
    await renderLoaded()

    fireEvent.change(screen.getByLabelText('New start (Kigali time)'), { target: { value: '2027-01-07T14:30' } })
    await user().click(screen.getByRole('button', { name: 'Move booking' }))

    await waitFor(() => expect(writes(sent)).toHaveLength(1))
    expect(writes(sent)[0]).toMatchObject({
      method: 'POST',
      url: `${DETAIL_API}/reschedule`,
      body: { startsAt: '2027-01-07T14:30:00+02:00' },
    })
  })

  it('re-renders from the booking the move answered with', async () => {
    const moved: AdminBooking = {
      ...BOOKING,
      schedule: {
        ...BOOKING.schedule,
        startsAt: '2027-01-07T12:30:00.000Z',
        endsAt: '2027-01-07T14:00:00.000Z',
        originalStartsAt: '2027-01-06T07:00:00.000Z',
        rescheduledAt: '2026-10-02T09:00:00.000Z',
      },
    }
    stubApi({ onPost: (_call, current) => ((current.value = moved), json({ booking: moved })) })
    await renderLoaded()

    fireEvent.change(screen.getByLabelText('New start (Kigali time)'), { target: { value: '2027-01-07T14:30' } })
    await user().click(screen.getByRole('button', { name: 'Move booking' }))

    await waitFor(() => expect(section('The shoot')).toHaveTextContent('Thursday, 7 January 2027, 14:30 – 16:00'))
    expect(section('The shoot')).toHaveTextContent('Originally booked for')
  })

  it('does not submit an empty field', async () => {
    const { sent } = stubApi()
    await renderLoaded()

    fireEvent.change(screen.getByLabelText('New start (Kigali time)'), { target: { value: '' } })
    await user().click(screen.getByRole('button', { name: 'Move booking' }))

    expect(writes(sent)).toEqual([])
  })
})

/**
 * Kigali is UTC+2 with no DST, and the field is Kigali wall time whatever the
 * browser thinks the time is (spec §6.5). Proven here against a browser five
 * hours behind Kigali; proven in Chromium with a real emulated zone in
 * `e2e/admin-bookings.spec.ts`.
 */
describe('with the browser in America/New_York', () => {
  const originalTimezone = process.env.TZ

  beforeAll(() => {
    process.env.TZ = 'America/New_York'
  })

  afterAll(() => {
    process.env.TZ = originalTimezone
  })

  it('still opens on Kigali wall time and still submits +02:00', async () => {
    // The environment really is five hours behind UTC, or this proves nothing.
    expect(new Date('2027-01-06T12:00:00Z').getTimezoneOffset()).toBe(300)
    const { sent } = stubApi()
    await renderLoaded()

    expect(screen.getByLabelText('New start (Kigali time)')).toHaveValue('2027-01-06T09:00')
    expect(section('The shoot')).toHaveTextContent('Wednesday, 6 January 2027, 09:00 – 10:30')

    await user().click(screen.getByRole('button', { name: 'Move booking' }))

    await waitFor(() => expect(writes(sent)).toHaveLength(1))
    expect(writes(sent)[0]?.body).toEqual({ startsAt: '2027-01-06T09:00:00+02:00' })
  })
})

// --- Cancelling ------------------------------------------------------------------------

describe('cancelling', () => {
  it('asks again before it cancels, and sends nothing until he confirms', async () => {
    const { sent } = stubApi()
    await renderLoaded()

    await user().click(screen.getByRole('button', { name: 'Cancel this booking' }))

    expect(screen.getByText(/Cancelling releases the time and tells the client/)).toBeInTheDocument()
    expect(screen.getByLabelText('Reason (shown to the client)')).toBeInTheDocument()
    expect(writes(sent)).toEqual([])
  })

  it('backs out without sending anything', async () => {
    const { sent } = stubApi()
    await renderLoaded()

    await user().click(screen.getByRole('button', { name: 'Cancel this booking' }))
    await user().click(screen.getByRole('button', { name: 'Keep the booking' }))

    expect(screen.queryByLabelText('Reason (shown to the client)')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel this booking' })).toBeInTheDocument()
    expect(writes(sent)).toEqual([])
  })

  it('carries the reason, trimmed, and re-renders the cancelled booking', async () => {
    const { sent } = stubApi({ onPost: (_call, current) => ((current.value = CANCELLED), json({ booking: CANCELLED })) })
    await renderLoaded()

    await user().click(screen.getByRole('button', { name: 'Cancel this booking' }))
    await user().type(screen.getByLabelText('Reason (shown to the client)'), '  Studio flooded.  ')
    await user().click(screen.getByRole('button', { name: 'Cancel and refund' }))

    await waitFor(() => expect(section('Money')).toHaveTextContent('To refund20,000 RWF'))
    expect(writes(sent)).toEqual([
      { method: 'POST', url: `${DETAIL_API}/cancel`, body: { reason: 'Studio flooded.' } },
    ])
    expect(screen.queryByRole('button', { name: 'Cancel this booking' })).not.toBeInTheDocument()
  })

  it('sends a null reason when he gives none', async () => {
    const { sent } = stubApi({ onPost: () => json({ booking: CANCELLED }) })
    await renderLoaded()

    await user().click(screen.getByRole('button', { name: 'Cancel this booking' }))
    await user().click(screen.getByRole('button', { name: 'Cancel and refund' }))

    await waitFor(() => expect(writes(sent)).toHaveLength(1))
    expect(writes(sent)[0]?.body).toEqual({ reason: null })
  })
})

// --- Completing, no-show and the link --------------------------------------------------

describe('the one-click actions', () => {
  it.each([
    ['Mark completed', 'complete', { ...STARTED, status: 'completed' }],
    ['Mark no-show', 'no-show', { ...STARTED, status: 'no_show' }],
  ])('%s posts to /%s and re-renders from the answer', async (label, path, answer) => {
    const next = { ...answer, actions: { ...STARTED.actions, canComplete: false, canMarkNoShow: false, canReschedule: false, canCancel: false } }
    const { sent } = stubApi({ booking: STARTED, onPost: (_call, current) => ((current.value = next), json({ booking: next })) })
    await renderLoaded()

    await user().click(screen.getByRole('button', { name: label }))

    await waitFor(() => expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument())
    expect(writes(sent)).toEqual([{ method: 'POST', url: `${DETAIL_API}/${path}`, body: {} }])
  })

  it('sends a new link and shows the fresh expiry it answered with', async () => {
    const relinked: AdminBooking = { ...BOOKING, access: { hasLink: true, expiresAt: '2028-01-01T06:00:00.000Z', lastUsedAt: null } }
    const { sent } = stubApi({ onPost: (_call, current) => ((current.value = relinked), json({ booking: relinked })) })
    await renderLoaded()
    expect(section('Client')).toHaveTextContent('Live until 1 Oct 2027, 08:05')

    await user().click(screen.getByRole('button', { name: 'Send a new booking link' }))

    await waitFor(() => expect(section('Client')).toHaveTextContent('Live until 1 Jan 2028, 08:00'))
    expect(writes(sent)).toEqual([{ method: 'POST', url: `${DETAIL_API}/resend-link`, body: {} }])
  })
})

// --- Recording a refund ------------------------------------------------------------------

describe('recording a refund (spec §6.16)', () => {
  const REFUNDED: AdminBooking = {
    ...CANCELLED,
    payments: [{ ...BOOKING_FEE, status: 'refunded', refundedAt: '2026-10-03T08:00:00.000Z', refundReference: 'MOMO-REF-7781', canRecordRefund: false }],
    money: { ...CANCELLED.money, totals: { ...CANCELLED.money.totals, refundDueRwf: 0 } },
  }

  it('offers the form only for a payment flagged for refund', async () => {
    stubApi({ booking: CANCELLED })
    await renderLoaded()

    expect(screen.getByLabelText('Refund reference')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Record 20,000 RWF refunded' })).toBeInTheDocument()
    expect(section('Payments')).toHaveTextContent('The system moves no money.')
  })

  it('posts the reference to the payment and shows the refunded state', async () => {
    const { sent } = stubApi({ booking: CANCELLED, onPost: (_call, current) => ((current.value = REFUNDED), json({ booking: REFUNDED })) })
    await renderLoaded()

    await user().type(screen.getByLabelText('Refund reference'), 'MOMO-REF-7781')
    await user().click(screen.getByRole('button', { name: 'Record 20,000 RWF refunded' }))

    await waitFor(() => expect(section('Payments')).toHaveTextContent('Refunded'))
    expect(writes(sent)).toEqual([
      { method: 'POST', url: `/api/admin/payments/${PAYMENT_ID}/refund`, body: { reference: 'MOMO-REF-7781' } },
    ])
    expect(section('Payments')).toHaveTextContent('refund MOMO-REF-7781')
    expect(screen.queryByLabelText('Refund reference')).not.toBeInTheDocument()
    expect(section('Money')).not.toHaveTextContent('To refund')
  })
})

// --- Refusals -----------------------------------------------------------------------------

describe('when the API refuses an action', () => {
  it('maps a 409 slot_taken to words and catches the screen up with what is true', async () => {
    const taken = { ...BOOKING, status: 'confirmed' }
    const { sent } = stubApi({
      onPost: (_call, current) => ((current.value = taken), json({ error: 'slot_taken', booking: taken }, 409)),
    })
    await renderLoaded()
    const before = gets(sent).length

    fireEvent.change(screen.getByLabelText('New start (Kigali time)'), { target: { value: '2027-01-07T14:30' } })
    await user().click(screen.getByRole('button', { name: 'Move booking' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('That time is already taken. Choose another.')
    // The refusal carried the booking, so the screen is already up to date and
    // asks for nothing more.
    expect(gets(sent).length).toBe(before)
  })

  it('maps a 409 not_allowed to words and re-renders the booking as it now is', async () => {
    const { sent } = stubApi({
      onPost: (_call, current) => ((current.value = CANCELLED), json({ error: 'not_allowed', booking: CANCELLED }, 409)),
    })
    await renderLoaded()

    await user().click(screen.getByRole('button', { name: 'Send a new booking link' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('That is not possible for this booking any more.')
    await waitFor(() => expect(section('Money')).toHaveTextContent('To refund20,000 RWF'))
    expect(screen.queryByRole('button', { name: 'Move booking' })).not.toBeInTheDocument()
    expect(gets(sent).length).toBe(1)
  })

  it('reads the booking again when a refusal arrives without one', async () => {
    const { sent } = stubApi({
      onPost: (_call, current) => ((current.value = CANCELLED), json({ error: 'not_allowed' }, 409)),
    })
    await renderLoaded()

    await user().click(screen.getByRole('button', { name: 'Send a new booking link' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('That is not possible for this booking any more.')
    await waitFor(() => expect(section('Money')).toHaveTextContent('To refund20,000 RWF'))
    expect(gets(sent).length).toBe(2)
  })

  it('maps a 409 unchanged to words', async () => {
    stubApi({ onPost: () => json({ error: 'unchanged', booking: BOOKING }, 409) })
    await renderLoaded()

    await user().click(screen.getByRole('button', { name: 'Move booking' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('That is the time the booking already has.')
  })

  it('maps a 409 not_refundable to words', async () => {
    stubApi({ booking: CANCELLED, onPost: () => json({ error: 'not_refundable', booking: CANCELLED }, 409) })
    await renderLoaded()

    await user().type(screen.getByLabelText('Refund reference'), 'MOMO-REF-7781')
    await user().click(screen.getByRole('button', { name: 'Record 20,000 RWF refunded' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('This payment is not flagged for a refund.')
  })

  it('falls back to a generic message for anything it has no words for', async () => {
    stubApi({ onPost: () => json({ error: 'internal_error' }, 500) })
    await renderLoaded()

    await user().click(screen.getByRole('button', { name: 'Send a new booking link' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('That did not work. Try again.')
  })

  it('sends him to sign in when an action answers 401', async () => {
    stubApi({ onPost: () => json({ error: 'unauthenticated' }, 401) })
    await renderLoaded()

    await user().click(screen.getByRole('button', { name: 'Send a new booking link' }))

    expect(await screen.findByRole('heading', { name: 'Admin sign in' })).toBeInTheDocument()
    expect(readSession()).toBeNull()
  })

  it('clears the previous error when the next action succeeds', async () => {
    let fail = true
    stubApi({
      onPost: () => {
        if (fail) {
          fail = false
          return json({ error: 'internal_error' }, 500)
        }
        return json({ booking: BOOKING })
      },
    })
    await renderLoaded()

    await user().click(screen.getByRole('button', { name: 'Send a new booking link' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()

    await user().click(screen.getByRole('button', { name: 'Send a new booking link' }))

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })
})
