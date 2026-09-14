import { type Page, expect, test } from '@playwright/test'

/**
 * The admin calendar in Chromium (plan.md Task 9; spec §3.3 step 1, §6.4,
 * §6.5). The API is answered here with `page.route`; the browser clock is
 * fixed; the browser zone is emulated with `timezoneId`, since Chromium ignores
 * the `TZ` variable on Windows.
 *
 * The clock is 2026-10-06 22:30 UTC: 00:30 on Wednesday 7 October in Kigali,
 * but still Tuesday 6 October, 18:30, in New York.
 */

const NOW = new Date('2026-10-06T22:30:00.000Z')
const SESSION = { token: 'e2e.header.signature', expiresAt: '2026-10-07T06:30:00.000Z' }
const SESSION_KEY = 'bookly.admin.session'

/** Three confirmed bookings, one live hold and one block, in October 2026. */
const OCTOBER = {
  bookings: [
    {
      id: 'b1',
      reference: 'BKY-2610-00001',
      status: 'confirmed',
      startsAt: '2026-10-07T07:00:00.000Z',
      endsAt: '2026-10-07T08:00:00.000Z',
      contactName: 'Grace Mukamana',
      serviceName: 'Wedding',
      packageName: 'Full day',
      conflictsWithBlock: true,
    },
    // 01:00 Kigali on Thursday 8th: still Wednesday 7th, 19:00, in New York.
    {
      id: 'b2',
      reference: 'BKY-2610-00002',
      status: 'pending_payment',
      startsAt: '2026-10-07T23:00:00.000Z',
      endsAt: '2026-10-08T00:00:00.000Z',
      contactName: 'Claudine Ingabire',
      serviceName: 'Portrait',
      packageName: 'Standard',
      conflictsWithBlock: false,
    },
    {
      id: 'b3',
      reference: 'BKY-2610-00003',
      status: 'confirmed',
      startsAt: '2026-10-15T12:00:00.000Z',
      endsAt: '2026-10-15T13:00:00.000Z',
      contactName: 'Eric Habimana',
      serviceName: 'Portrait',
      packageName: 'Standard',
      conflictsWithBlock: false,
    },
    // 23:30 Kigali on Friday 23rd: already Saturday 24th, 11:30, in Kiritimati.
    {
      id: 'b4',
      reference: 'BKY-2610-00004',
      status: 'confirmed',
      startsAt: '2026-10-23T21:30:00.000Z',
      endsAt: '2026-10-23T22:00:00.000Z',
      contactName: 'Divine Uwera',
      serviceName: 'Event',
      packageName: 'Evening',
      conflictsWithBlock: false,
    },
  ],
  blocks: [
    {
      id: 'k1',
      startsAt: '2026-10-07T07:30:00.000Z',
      endsAt: '2026-10-07T09:00:00.000Z',
      isAllDay: false,
      reason: 'Clinic',
    },
  ],
}

/** What the October month grid must show, identically in every browser zone. */
const MONTH_ENTRIES: [day: string, status: string, texts: string[]][] = [
  ['Wed 7 Oct', 'confirmed', ['09:00', 'Grace Mukamana', 'Confirmed', 'Conflicts with a block']],
  ['Wed 7 Oct', 'block', ['09:30–11:00', 'Blocked']],
  ['Thu 8 Oct', 'pending_payment', ['01:00', 'Claudine Ingabire', 'Hold']],
  ['Thu 15 Oct', 'confirmed', ['14:00', 'Eric Habimana', 'Confirmed']],
  ['Fri 23 Oct', 'confirmed', ['23:30', 'Divine Uwera', 'Confirmed']],
]

type CalendarRequest = { from: string | null; to: string | null; authorization: string | null }

type LoginAnswer = { status: number; body: unknown }

/** Answers `/api/*` in the page; returns the calendar requests as they arrive. */
async function mockApi(page: Page, login: LoginAnswer = { status: 401, body: { error: 'invalid_credentials' } }) {
  const calendarRequests: CalendarRequest[] = []
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      if (request.method() === 'GET' && url.pathname === '/api/admin/calendar') {
        calendarRequests.push({
          from: url.searchParams.get('from'),
          to: url.searchParams.get('to'),
          authorization: await request.headerValue('authorization'),
        })
        await route.fulfill({ json: OCTOBER })
        return
      }
      if (request.method() === 'POST' && url.pathname === '/api/admin/auth/login') {
        await route.fulfill({ status: login.status, json: login.body })
        return
      }
      await route.fulfill({ status: 404, json: { error: 'not_found' } })
    },
  )
  return calendarRequests
}

async function seedSession(page: Page) {
  await page.addInitScript(
    ([key, value]) => {
      window.sessionStorage.setItem(key, value)
    },
    [SESSION_KEY, JSON.stringify(SESSION)] as const,
  )
}

/** Every rendered entry as [day, status, visible text], in DOM order. */
function renderedEntries(page: Page) {
  return page.locator('section[aria-label]').evaluateAll((sections) =>
    sections.flatMap((section) =>
      Array.from(section.querySelectorAll('li')).map((item) => ({
        day: section.getAttribute('aria-label') ?? '',
        status: item.dataset.status ?? '',
        text: item.innerText.replace(/\s+/g, ' ').trim(),
      })),
    ),
  )
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW)
})

for (const [timezoneId, localHourAtNow] of [
  ['Africa/Kigali', 0],
  ['America/New_York', 18],
  ['Pacific/Kiritimati', 12],
] as const) {
  test.describe(`with the browser in ${timezoneId}`, () => {
    test.use({ timezoneId })

    test('shows the same Kigali times on the same Kigali days', async ({ page }) => {
      await seedSession(page)
      await mockApi(page)

      await page.goto('/admin/calendar?view=month&date=2026-10-07')

      // The emulation is real: the browser's own clock reads a different hour.
      expect(
        await page.evaluate(() => [Intl.DateTimeFormat().resolvedOptions().timeZone, new Date().getHours()]),
      ).toEqual([timezoneId, localHourAtNow])

      await expect(page.getByRole('heading', { level: 1, name: 'October 2026' })).toBeVisible()
      await expect(page.getByRole('listitem')).toHaveCount(5)
      const entries = await renderedEntries(page)
      expect(entries.map(({ day, status }) => [day, status])).toEqual(MONTH_ENTRIES.map(([day, status]) => [day, status]))
      for (const [index, [, , texts]] of MONTH_ENTRIES.entries()) {
        for (const text of texts) expect(entries[index]?.text).toContain(text)
      }
      await expect(page.getByRole('region', { name: 'Wed 7 Oct' }).getByRole('button')).toHaveAttribute('aria-current', 'date')

      await page.goto('/admin/calendar?view=week&date=2026-10-07')

      const thursday = page.getByRole('region', { name: 'Thu 8 Oct' })
      await expect(thursday.getByRole('listitem')).toHaveCount(1)
      await expect(thursday).toContainText('01:00–02:00')
      await expect(page.getByRole('region', { name: 'Wed 7 Oct' })).toContainText('09:00–10:00')
      await expect(page.getByRole('region', { name: 'Wed 7 Oct' })).not.toContainText('Claudine Ingabire')

      await page.goto('/admin/calendar?view=week&date=2026-10-23')

      await expect(page.getByRole('region', { name: 'Fri 23 Oct' })).toContainText('23:30–00:00')
      await expect(page.getByRole('region', { name: 'Sat 24 Oct' })).toContainText('Nothing scheduled.')

      // "Today" is Kigali's today, whatever date the browser's zone is on.
      await page.goto('/admin/calendar?view=day')

      await expect(page.getByRole('heading', { level: 1, name: 'Wed 7 Oct' })).toBeVisible()
    })
  })
}

test('marks the booking that overlaps a block with a visible conflict marker', async ({ page }) => {
  await seedSession(page)
  await mockApi(page)

  await page.goto('/admin/calendar?view=month&date=2026-10-07')

  const marker = page.getByText('Conflicts with a block')
  await expect(marker).toHaveCount(1)
  await expect(marker).toBeVisible()
  await expect(page.getByRole('listitem').filter({ has: marker })).toContainText('Grace Mukamana')
})

test('switches between month, week and day, fetching each visible range', async ({ page }) => {
  await seedSession(page)
  const requests = await mockApi(page)

  await page.goto('/admin/calendar?view=month&date=2026-10-07')
  await expect(page.getByRole('listitem')).toHaveCount(5)

  await page.getByRole('tab', { name: 'Week' }).click()

  await expect(page).toHaveURL(/\?view=week&date=2026-10-07$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Mon 5 Oct – Sun 11 Oct' })).toBeVisible()
  await expect(page.getByRole('region')).toHaveCount(7)
  await expect(page.getByText('Wedding · Full day · BKY-2610-00001')).toBeVisible()
  await expect(page.getByText('Clinic')).toBeVisible()

  await page.getByRole('tab', { name: 'Day' }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Wed 7 Oct' })).toBeVisible()
  await expect(page.getByRole('listitem')).toHaveCount(2)

  await page.getByRole('button', { name: 'Next' }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Thu 8 Oct' })).toBeVisible()
  await expect(page.getByRole('listitem')).toHaveCount(1)

  await page.getByRole('tab', { name: 'Month' }).click()
  await page.getByRole('region', { name: 'Thu 15 Oct' }).getByRole('button', { name: '15' }).click()

  await expect(page).toHaveURL(/\?view=day&date=2026-10-15$/)
  await expect(page.getByRole('listitem')).toHaveCount(1)

  // Consecutive repeats collapsed: the dev server runs React's StrictMode, whose
  // simulated remount starts, aborts and restarts the first request.
  const ranges = requests.map(({ from, to }) => `${from}/${to}`)
  expect(ranges.filter((range, index) => range !== ranges[index - 1])).toEqual([
    '2026-09-28/2026-11-01',
    '2026-10-05/2026-10-11',
    '2026-10-07/2026-10-07',
    '2026-10-08/2026-10-08',
    '2026-09-28/2026-11-01',
    '2026-10-15/2026-10-15',
  ])
  expect(new Set(requests.map(({ authorization }) => authorization))).toEqual(new Set([`Bearer ${SESSION.token}`]))
})

test.describe('signing in', () => {
  test('sends a signed-out visitor to sign in, then to the calendar with the issued token', async ({ page }) => {
    const requests = await mockApi(page, {
      status: 200,
      body: { admin: { id: 'a1', email: 'photographer@bookly.example' }, ...SESSION, tokenType: 'Bearer' },
    })

    await page.goto('/admin/calendar?view=month&date=2026-10-07')

    await expect(page).toHaveURL(/\/admin\/login$/)
    expect(requests).toEqual([])

    const loginRequest = page.waitForRequest((request) => request.url().endsWith('/api/admin/auth/login'))
    await page.getByLabel('Email').fill('photographer@bookly.example')
    await page.getByLabel('Password').fill('correct horse battery staple')
    await page.getByRole('button', { name: 'Sign in' }).click()

    expect((await loginRequest).postDataJSON()).toEqual({
      email: 'photographer@bookly.example',
      password: 'correct horse battery staple',
    })
    await expect(page).toHaveURL(/\/admin\/calendar$/)
    await expect(page.getByRole('heading', { level: 1, name: 'October 2026' })).toBeVisible()
    await expect(page.getByRole('listitem')).toHaveCount(5)
    expect(requests.at(-1)).toEqual({ from: '2026-09-28', to: '2026-11-01', authorization: `Bearer ${SESSION.token}` })
    expect(
      await page.evaluate((key) => [window.sessionStorage.getItem(key), window.localStorage.length], SESSION_KEY),
    ).toEqual([JSON.stringify(SESSION), 0])

    // sessionStorage survives a reload, so he stays signed in.
    await page.reload()
    await expect(page.getByRole('listitem')).toHaveCount(5)

    await page.getByRole('button', { name: 'Sign out' }).click()

    await expect(page).toHaveURL(/\/admin\/login$/)
    expect(await page.evaluate((key) => window.sessionStorage.getItem(key), SESSION_KEY)).toBeNull()
  })

  test('shows one message for refused credentials and stays on the form', async ({ page }) => {
    await mockApi(page, { status: 401, body: { error: 'invalid_credentials' } })

    await page.goto('/admin/login')
    await page.getByLabel('Email').fill('photographer@bookly.example')
    await page.getByLabel('Password').fill('wrong password')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByRole('alert')).toHaveText('That email and password did not work.')
    await expect(page).toHaveURL(/\/admin\/login$/)
  })
})
