import { type Page, expect, test } from '@playwright/test'

/**
 * The bookings list and one booking's lifecycle in Chromium (plan.md Task 19;
 * spec §3.6, §6.11, §6.16, §6.21). `/api/*` is answered here by a small
 * in-memory API that behaves like the real one: it filters the list by status,
 * moves a booking to the instant it is sent, and on a cancellation flags what
 * was collected for refund.
 *
 * The browser is in America/New_York, five hours behind Kigali. Every time on
 * screen -- the list, the detail page and the reschedule field -- must still be
 * Kigali wall time (spec §6.5), and the time the page sends back must still
 * carry `+02:00`.
 */

const NOW = new Date('2026-10-07T08:00:00.000Z')
const TOKEN = 'e2e.header.signature'
const EXPIRES_AT = '2026-10-07T16:00:00.000Z'
const MINUTE_MS = 60_000

/** 09:00 to 10:30 Kigali on Wednesday 6 January 2027. */
const STARTS_AT = '2027-01-06T07:00:00.000Z'

test.use({ timezoneId: 'America/New_York' })

type Booking = Record<string, unknown> & { id: string; reference: string; status: string }
type Write = { method: string; path: string; body: unknown; authorization: string | null }

function booking(id: string, reference: string, status: string, startsAt: string, contactName: string): Booking {
  const starts = Date.parse(startsAt)
  return {
    id,
    reference,
    status,
    locale: 'en',
    client: { id: 'cl1', fullName: contactName, email: 'aline@example.com', phone: '+250788000000', anonymized: false },
    contact: { name: contactName, email: 'aline@example.com', phone: '+250788000000' },
    service: { id: 's1', name: 'Portraits' },
    package: { id: 'p1', name: 'Standard', priceRwf: 40_000, durationMinutes: 90, photoCount: 25 },
    schedule: {
      startsAt,
      endsAt: new Date(starts + 90 * MINUTE_MS).toISOString(),
      bufferEndsAt: new Date(starts + 120 * MINUTE_MS).toISOString(),
      holdExpiresAt: null,
      originalStartsAt: null,
      rescheduledAt: null,
    },
    details: { locationText: 'Kigali Heights, KG 7 Ave', partySize: 3, specialRequests: null, consentAt: '2026-10-01T06:00:00.000Z' },
    addons: [],
    money: {
      bookingFeeRate: 0.4,
      bookingFeeRwf: 16_000,
      totals: { quotedTotalRwf: 40_000, grandTotalRwf: 40_000, collectedRwf: 20_000, refundDueRwf: 0, outstandingRwf: 20_000 },
    },
    payments: [
      {
        id: 'pay1',
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
      },
    ],
    lifecycle: { confirmedAt: '2026-10-01T06:05:00.000Z', completedAt: null, cancelledAt: null, cancellationReason: null },
    access: { hasLink: true, expiresAt: '2027-10-01T06:05:00.000Z', lastUsedAt: null },
    delivery: { url: null, expiresOn: null, sentAt: null, note: null },
    messages: [],
    actions: { canReschedule: true, canCancel: true, canComplete: false, canMarkNoShow: false, canResendLink: true, canEditAddons: false, canRequestSessionFee: false },
  }
}

/** The list row the API derives from a booking. */
function row(entry: Booking) {
  const schedule = entry.schedule as { startsAt: string; endsAt: string }
  const totals = (entry.money as { totals: Record<string, number> }).totals
  return {
    id: entry.id,
    reference: entry.reference,
    status: entry.status,
    startsAt: schedule.startsAt,
    endsAt: schedule.endsAt,
    contactName: (entry.contact as { name: string }).name,
    contactEmail: (entry.contact as { email: string }).email,
    contactPhone: (entry.contact as { phone: string }).phone,
    serviceName: 'Portraits',
    packageName: 'Standard',
    grandTotalRwf: totals.grandTotalRwf,
    collectedRwf: totals.collectedRwf,
    outstandingRwf: totals.outstandingRwf,
    refundDueRwf: totals.refundDueRwf,
    hasRefundDue: totals.refundDueRwf > 0,
  }
}

/** Answers `/api/*` in the page; returns the writes as they arrive. */
async function mockApi(page: Page) {
  const bookings: Booking[] = [
    booking('b1', 'BKY-2701-00042', 'confirmed', STARTS_AT, 'Aline Uwase'),
    booking('b2', 'BKY-2701-00043', 'cancelled_by_client', '2027-01-05T12:00:00.000Z', 'Eric Habimana'),
  ]
  const writes: Write[] = []

  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const request = route.request()
      const method = request.method()
      const url = new URL(request.url())
      const path = url.pathname
      const find = (id: string) => bookings.find((entry) => entry.id === id)

      if (method === 'POST' && path === '/api/admin/auth/login') {
        await route.fulfill({
          json: { admin: { id: 'a1', email: 'photographer@bookly.example' }, token: TOKEN, tokenType: 'Bearer', expiresAt: EXPIRES_AT },
        })
        return
      }
      if (method === 'GET' && path === '/api/admin/calendar') {
        await route.fulfill({ json: { bookings: [], blocks: [] } })
        return
      }
      if (method === 'GET' && path === '/api/admin/bookings') {
        const statuses = url.searchParams.getAll('status')
        const search = url.searchParams.get('search') ?? ''
        const matching = bookings
          .filter((entry) => statuses.length === 0 || statuses.includes(entry.status))
          .filter((entry) => search === '' || entry.reference.toLowerCase().includes(search.toLowerCase()))
        await route.fulfill({ json: { bookings: matching.map(row), nextCursor: null } })
        return
      }

      const detail = /^\/api\/admin\/bookings\/([^/]+)$/.exec(path)?.[1]
      if (method === 'GET' && detail !== undefined) {
        const entry = find(detail)
        await route.fulfill(entry === undefined ? { status: 404, json: { error: 'not_found' } } : { json: { booking: entry } })
        return
      }

      const action = /^\/api\/admin\/bookings\/([^/]+)\/([a-z-]+)$/.exec(path)
      const body = request.postDataJSON() as Record<string, unknown> | null
      writes.push({ method, path, body, authorization: await request.headerValue('authorization') })
      const entry = action === null ? undefined : find(action[1] ?? '')

      if (entry !== undefined && action?.[2] === 'reschedule') {
        const starts = Date.parse(String(body?.startsAt))
        const previous = (entry.schedule as { startsAt: string }).startsAt
        entry.schedule = {
          startsAt: new Date(starts).toISOString(),
          endsAt: new Date(starts + 90 * MINUTE_MS).toISOString(),
          bufferEndsAt: new Date(starts + 120 * MINUTE_MS).toISOString(),
          holdExpiresAt: null,
          originalStartsAt: previous,
          rescheduledAt: NOW.toISOString(),
        }
        await route.fulfill({ json: { booking: entry } })
        return
      }
      if (entry !== undefined && action?.[2] === 'cancel') {
        entry.status = 'cancelled_by_admin'
        entry.lifecycle = { confirmedAt: '2026-10-01T06:05:00.000Z', completedAt: null, cancelledAt: NOW.toISOString(), cancellationReason: String(body?.reason ?? '') }
        entry.payments = [{ ...(entry.payments as Record<string, unknown>[])[0], status: 'refund_due', canRecordRefund: true }]
        entry.money = {
          bookingFeeRate: 0.4,
          bookingFeeRwf: 16_000,
          totals: { quotedTotalRwf: 40_000, grandTotalRwf: 40_000, collectedRwf: 0, refundDueRwf: 20_000, outstandingRwf: 0 },
        }
        entry.actions = { canReschedule: false, canCancel: false, canComplete: false, canMarkNoShow: false, canResendLink: true, canEditAddons: false, canRequestSessionFee: false }
        await route.fulfill({ json: { booking: entry } })
        return
      }

      await route.fulfill({ status: 404, json: { error: 'not_found' } })
    },
  )
  return writes
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW)
})

test('signs in, filters the list, moves a booking and then cancels it', async ({ page }) => {
  const writes = await mockApi(page)

  // The browser really is five hours behind Kigali, or this proves nothing.
  expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('America/New_York')

  await page.goto('/admin/login')
  await page.getByLabel('Email').fill('photographer@bookly.example')
  await page.getByLabel('Password').fill('dev-only-change-me-123')
  await page.getByRole('button', { name: 'Sign in' }).click()

  const nav = page.getByRole('navigation', { name: 'Admin' })
  await nav.getByRole('link', { name: 'Bookings' }).click()
  await expect(page).toHaveURL(/\/admin\/bookings$/)

  // Both bookings, each in Kigali wall time rather than the browser's own.
  const rows = page.getByRole('table').getByRole('row')
  await expect(rows).toHaveCount(3)
  await expect(rows.nth(1)).toContainText('Wednesday, 6 January 2027')
  await expect(rows.nth(1)).toContainText('09:00 – 10:30')

  await page.getByRole('button', { name: 'Confirmed' }).click()

  await expect(page).toHaveURL(/\?status=confirmed$/)
  await expect(rows).toHaveCount(2)
  await expect(page.getByRole('link', { name: 'BKY-2701-00042' })).toBeVisible()

  await page.getByRole('link', { name: 'BKY-2701-00042' }).click()

  await expect(page).toHaveURL(/\/admin\/bookings\/b1$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('BKY-2701-00042')
  const shoot = page.locator('section').filter({ has: page.getByRole('heading', { level: 2, name: 'The shoot' }) })
  await expect(shoot).toContainText('Wednesday, 6 January 2027, 09:00 – 10:30')

  // The field opens on Kigali wall time, not on the browser's 02:00.
  const newStart = page.getByLabel('New start (Kigali time)')
  await expect(newStart).toHaveValue('2027-01-06T09:00')
  await newStart.fill('2027-01-07T14:30')
  await page.getByRole('button', { name: 'Move booking' }).click()

  await expect(shoot).toContainText('Thursday, 7 January 2027, 14:30 – 16:00')
  await expect(shoot).toContainText('Originally booked for')
  expect(writes[0]).toEqual({
    method: 'POST',
    path: '/api/admin/bookings/b1/reschedule',
    body: { startsAt: '2027-01-07T14:30:00+02:00' },
    authorization: `Bearer ${TOKEN}`,
  })

  await page.getByRole('button', { name: 'Cancel this booking' }).click()
  await expect(page.getByText(/Cancelling releases the time and tells the client/)).toBeVisible()
  await page.getByLabel('Reason (shown to the client)').fill('Studio flooded.')
  await page.getByRole('button', { name: 'Cancel and refund' }).click()

  await expect(page.getByText('Cancelled by you')).toBeVisible()
  const money = page.locator('section').filter({ has: page.getByRole('heading', { level: 2, name: 'Money' }) })
  await expect(money).toContainText('To refund20,000 RWF')
  await expect(page.getByLabel('Refund reference')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Move booking' })).toHaveCount(0)
  expect(writes[1]).toMatchObject({ method: 'POST', path: '/api/admin/bookings/b1/cancel', body: { reason: 'Studio flooded.' } })

  // And the list shows the money owed back.
  await page.getByRole('link', { name: 'All bookings' }).click()
  await expect(page.getByText('20,000 RWF to refund')).toBeVisible()
})
