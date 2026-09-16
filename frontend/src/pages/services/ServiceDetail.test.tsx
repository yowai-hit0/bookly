import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/i18n'
import type { PublicServiceDetail } from '@/catalogue/api'
import { routes } from '@/routes'

/**
 * One service's page (plan.md Task 11; spec §3.1 steps 2, 3 and 7, §6.14),
 * rendered through the real routes with `fetch` stubbed.
 *
 * What is proven: nothing is preselected; choosing a package and ticking or
 * unticking add-ons updates the total, booking fee and session fee live, at the
 * service's own rate; the non-refundable notice is there from the start; an
 * unknown or deactivated slug is the not-found page; a failed load can be
 * retried; and each package reads its photos and duration in words.
 *
 * With the slot picker (plan.md Task 12): no availability is asked for until a
 * package is chosen; then the chosen package's month is, and switching to a
 * longer package asks again for it and shows its fewer starts on the same date.
 * The picker's own behaviour is proven in SlotPicker.test.tsx.
 */

const API = '/api/services'

// --- Fixtures ---------------------------------------------------------------

const PORTRAITS: PublicServiceDetail = {
  id: 's1',
  slug: 'portraits',
  nameEn: 'Portraits',
  descriptionEn: 'Studio portraits.',
  coverImageUrl: 'https://images.example.com/portraits.jpg',
  packages: [
    { id: 'p1', nameEn: 'Mini', descriptionEn: null, priceRwf: 25_000, photoCount: 1, durationMinutes: 45 },
    { id: 'p2', nameEn: 'Standard', descriptionEn: 'One look, one location.', priceRwf: 40_000, photoCount: 20, durationMinutes: 90 },
    { id: 'p3', nameEn: 'Extended', descriptionEn: null, priceRwf: 60_000, photoCount: 2, durationMinutes: 120 },
    { id: 'p4', nameEn: 'Quick', descriptionEn: null, priceRwf: 15_000, photoCount: 0, durationMinutes: 60 },
  ],
  addons: [
    { id: 'a1', nameEn: 'Extra hour', priceRwf: 10_000 },
    { id: 'a2', nameEn: 'Rush edit', priceRwf: 5_000 },
  ],
  bookingFeeRate: 0.4,
}

const WEDDINGS: PublicServiceDetail = {
  id: 's2',
  slug: 'weddings',
  nameEn: 'Weddings',
  descriptionEn: null,
  coverImageUrl: null,
  packages: [{ id: 'p5', nameEn: 'Standard', descriptionEn: null, priceRwf: 40_000, photoCount: 150, durationMinutes: 240 }],
  addons: [{ id: 'a3', nameEn: 'Second shooter', priceRwf: 10_000 }],
  bookingFeeRate: 0.3,
}

const PRODUCTS: PublicServiceDetail = {
  id: 's3',
  slug: 'products',
  nameEn: 'Product shots',
  descriptionEn: null,
  coverImageUrl: null,
  packages: [],
  addons: [{ id: 'a2', nameEn: 'Rush edit', priceRwf: 5_000 }],
  bookingFeeRate: 0.4,
}

const NOTICE = 'The booking fee is non-refundable if you cancel.'
const PROMPT = 'Choose a package to see your total.'

/** Kigali start times per package on Wednesday 7 October 2026: the longer the package, the fewer. */
const WEDNESDAY_STARTS: Record<string, string[]> = {
  p1: ['09:00', '09:30', '10:00', '10:30', '14:00'],
  p2: ['09:00', '09:30', '14:00'],
  p3: ['09:00', '09:30'],
}

/** Every date of `month`, with the package's Wednesday starts on the 7th of October. */
function availabilityFor(packageId: string, month: string) {
  const [year, monthNumber] = month.split('-').map(Number) as [number, number]
  const length = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  return Array.from({ length }, (_, index) => {
    const date = `${month}-${String(index + 1).padStart(2, '0')}`
    const times = date === '2026-10-07' ? (WEDNESDAY_STARTS[packageId] ?? []) : []
    return { date, starts: times.map((time) => new Date(`${date}T${time}:00+02:00`).toISOString()) }
  })
}

type Route = () => Response | Promise<Response>

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

/**
 * A `fetch` for the public API. `routes` answers a URL; otherwise the three
 * services answer as the API would, the list answers all three, availability
 * answers a month for any package, and anything else is the API's 404.
 */
function stubApi(routes: Record<string, Route> = {}) {
  const sent: string[] = []
  const mock = vi.fn(async (input: string | URL | Request) => {
    const url = String(input)
    sent.push(url)
    const route = routes[url]
    if (route !== undefined) return route()
    if (url.startsWith('/api/availability?')) {
      const query = new URLSearchParams(url.slice(url.indexOf('?') + 1))
      return json({ days: availabilityFor(query.get('packageId') ?? '', query.get('month') ?? '') })
    }
    if (url === API) return json({ services: [PORTRAITS, WEDDINGS, PRODUCTS] })
    const service = [PORTRAITS, WEDDINGS, PRODUCTS].find((candidate) => url === `${API}/${candidate.slug}`)
    if (service !== undefined) return json({ service })
    return json({ error: 'not_found' }, 404)
  })
  vi.stubGlobal('fetch', mock)
  return sent
}

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

async function renderLoaded(service: PublicServiceDetail = PORTRAITS) {
  const router = renderAt(`/services/${service.slug}`)
  await screen.findByRole('heading', { level: 1, name: service.nameEn })
  return router
}

function user() {
  return userEvent.setup({ delay: null })
}

function summary(): HTMLElement {
  return screen.getByRole('region', { name: 'Price summary' })
}

/** Every term and its amount in the summary, in the order they render. */
function lines(): [string, string][] {
  return Array.from(summary().querySelectorAll('dt')).map((term) => [
    term.textContent ?? '',
    term.nextElementSibling?.textContent ?? '',
  ])
}

/** Total, booking fee line and session fee, as the visitor reads them. */
function totals(): { total: string; bookingFee: [string, string]; sessionFee: string } {
  const all = lines()
  const find = (predicate: (term: string) => boolean) => all.find(([term]) => predicate(term)) ?? ['', '']
  return {
    total: find((term) => term === 'Total')[1],
    bookingFee: find((term) => term.startsWith('Booking fee')),
    sessionFee: find((term) => term.startsWith('Session fee'))[1],
  }
}

/**
 * A row's accessible name is its whole label, name then price: jsdom reads
 * "Standard40,000 RWF20 photos · …", so match the name followed by the price.
 */
function startsWithName(name: string) {
  return (accessibleName: string) =>
    accessibleName.startsWith(name) && /^\d/.test(accessibleName.slice(name.length).trimStart())
}

function packageRadio(name: string): HTMLElement {
  return screen.getByRole('radio', { name: startsWithName(name) })
}

function addonCheckbox(name: string): HTMLElement {
  return screen.getByRole('checkbox', { name: startsWithName(name) })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// --- Loading ---------------------------------------------------------------------------------

describe('loading a service', () => {
  it('shows a loading status, then the service, fetched from /api/services/<slug>', async () => {
    let answer: (res: Response) => void = () => {}
    const sent = stubApi({ [`${API}/portraits`]: () => new Promise<Response>((resolve) => (answer = resolve)) })
    renderAt('/services/portraits')

    expect(await screen.findByRole('status')).toHaveTextContent('Loading…')
    expect(screen.getByRole('link', { name: '← All services' })).toHaveAttribute('href', '/services')
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()

    answer(json({ service: PORTRAITS }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Portraits' })).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(sent).toEqual([`${API}/portraits`])
  })

  it('renders the not-found page for a slug the API answers 404 -- unknown or deactivated', async () => {
    const sent = stubApi()
    renderAt('/services/events')

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
    expect(screen.getByText('That page does not exist.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument()
    expect(sent).toEqual([`${API}/events`])
  })

  it('encodes the slug into the request path', async () => {
    const sent = stubApi()
    renderAt('/services/a%3Fb')

    await screen.findByRole('heading', { name: 'Page not found' })
    expect(sent).toEqual([`${API}/a%3Fb`])
  })

  it('shows an alert when the API fails, and loads again on "Try again"', async () => {
    let calls = 0
    const sent = stubApi({
      [`${API}/portraits`]: () => (++calls === 1 ? json({ error: 'internal_error' }, 500) : json({ service: PORTRAITS })),
    })
    renderAt('/services/portraits')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Could not load this service. Check your connection and try again.')
    // A failure is not a 404: the page does not claim the service is gone.
    expect(screen.queryByRole('heading', { name: 'Page not found' })).not.toBeInTheDocument()

    await user().click(within(alert).getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Portraits' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(sent).toEqual([`${API}/portraits`, `${API}/portraits`])
  })

  it('shows the alert when the network is down', async () => {
    stubApi({ [`${API}/portraits`]: () => Promise.reject(new TypeError('Failed to fetch')) })
    renderAt('/services/portraits')

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load this service.')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('shows loading, not the previous service, while moving to another service', async () => {
    let answer: (res: Response) => void = () => {}
    stubApi({ [`${API}/weddings`]: () => new Promise<Response>((resolve) => (answer = resolve)) })
    const router = await renderLoaded(PORTRAITS)
    await user().click(packageRadio('Standard'))

    await router.navigate('/services/weddings')

    expect(await screen.findByRole('status')).toHaveTextContent('Loading…')
    expect(screen.queryByRole('heading', { level: 1, name: 'Portraits' })).not.toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()

    answer(json({ service: WEDDINGS }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Weddings' })).toBeInTheDocument()
    // A fresh page: nothing carried over from Portraits.
    expect(packageRadio('Standard')).not.toBeChecked()
    expect(within(summary()).getByText(PROMPT)).toBeInTheDocument()
  })
})

// --- Rendering ------------------------------------------------------------------------------

describe('the service page', () => {
  it('renders the service, a radio per package and a checkbox per add-on, with nothing chosen', async () => {
    stubApi()
    await renderLoaded()

    expect(screen.getByText('Studio portraits.')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Choose a package' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Add-ons (optional)' })).toBeInTheDocument()

    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(4)
    for (const radio of radios) expect(radio).not.toBeChecked()
    // One group: choosing one package un-chooses the others.
    expect(new Set(radios.map((radio) => radio.getAttribute('name'))).size).toBe(1)

    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes).toHaveLength(2)
    for (const checkbox of checkboxes) expect(checkbox).not.toBeChecked()

    expect(within(summary()).getByText(PROMPT)).toBeInTheDocument()
    expect(summary()).not.toHaveTextContent(/RWF/)
  })

  it('shows the non-refundable notice before anything is chosen, and keeps it after', async () => {
    stubApi()
    await renderLoaded()

    expect(within(summary()).getByText(NOTICE)).toBeVisible()

    await user().click(packageRadio('Standard'))
    await user().click(addonCheckbox('Extra hour'))

    expect(within(summary()).getByText(NOTICE)).toBeVisible()
  })

  it('reads each package’s price, photos and duration in words', async () => {
    stubApi()
    await renderLoaded()

    expect(packageRadio('Mini').closest('label')).toHaveTextContent('Mini25,000 RWF1 photo · 45 min')
    expect(packageRadio('Standard').closest('label')).toHaveTextContent('Standard40,000 RWF20 photos · 1 h 30 minOne look, one location.')
    expect(packageRadio('Extended').closest('label')).toHaveTextContent('Extended60,000 RWF2 photos · 2 hours')
    expect(packageRadio('Quick').closest('label')).toHaveTextContent('Quick15,000 RWF0 photos · 1 hour')
    expect(addonCheckbox('Extra hour').closest('label')).toHaveTextContent('Extra hour10,000 RWF')
    expect(addonCheckbox('Rush edit').closest('label')).toHaveTextContent('Rush edit5,000 RWF')
  })

  it('names each radio and checkbox by its row, so a screen reader hears what is chosen', async () => {
    stubApi()
    await renderLoaded()

    expect(screen.getByRole('radio', { name: /Standard.*40,000 RWF/ })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /Extra hour.*10,000 RWF/ })).toBeInTheDocument()
  })

  it('says so when the service has no packages, and offers nothing to choose or pay', async () => {
    stubApi()
    await renderLoaded(PRODUCTS)

    expect(screen.getByText('No packages are available for this service right now.')).toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Price summary' })).not.toBeInTheDocument()
  })

  it('omits the add-on group for a service without add-ons', async () => {
    stubApi({ [`${API}/weddings`]: () => json({ service: { ...WEDDINGS, addons: [] } }) })
    await renderLoaded(WEDDINGS)

    expect(screen.queryByRole('group', { name: 'Add-ons (optional)' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(1)
  })

  it('links back to the list', async () => {
    stubApi()
    const router = await renderLoaded()

    await user().click(screen.getByRole('link', { name: '← All services' }))

    expect(await screen.findByRole('link', { name: 'Weddings' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/services')
  })

  it('never mentions a processing fee, whatever is chosen', async () => {
    stubApi()
    await renderLoaded()
    const u = user()

    expect(document.body).not.toHaveTextContent(/processing/i)
    await u.click(packageRadio('Standard'))
    await u.click(addonCheckbox('Extra hour'))
    await u.click(addonCheckbox('Rush edit'))
    expect(document.body).not.toHaveTextContent(/processing/i)
  })
})

// --- The live total (plan.md Task 11) ------------------------------------------------------------

describe('the price summary', () => {
  it('shows 50,000 total, 20,000 now at 40% and 30,000 after for Standard plus a 10,000 add-on', async () => {
    stubApi()
    await renderLoaded()
    const u = user()

    await u.click(packageRadio('Standard'))

    expect(packageRadio('Standard')).toBeChecked()
    expect(lines()).toEqual([
      ['Standard', '40,000 RWF'],
      ['Total', '40,000 RWF'],
      ['Booking fee (40%), paid now to secure your date', '16,000 RWF'],
      ['Session fee, due after the shoot', '24,000 RWF'],
    ])

    await u.click(addonCheckbox('Extra hour'))

    expect(addonCheckbox('Extra hour')).toBeChecked()
    expect(lines()).toEqual([
      ['Standard', '40,000 RWF'],
      ['Extra hour', '10,000 RWF'],
      ['Total', '50,000 RWF'],
      ['Booking fee (40%), paid now to secure your date', '20,000 RWF'],
      ['Session fee, due after the shoot', '30,000 RWF'],
    ])
  })

  it('updates when an add-on is unticked and when the package is switched', async () => {
    stubApi()
    await renderLoaded()
    const u = user()
    await u.click(packageRadio('Standard'))
    await u.click(addonCheckbox('Extra hour'))
    await u.click(addonCheckbox('Rush edit'))
    expect(totals()).toEqual({
      total: '55,000 RWF',
      bookingFee: ['Booking fee (40%), paid now to secure your date', '22,000 RWF'],
      sessionFee: '33,000 RWF',
    })

    await u.click(addonCheckbox('Rush edit'))

    expect(addonCheckbox('Rush edit')).not.toBeChecked()
    expect(totals()).toMatchObject({ total: '50,000 RWF', sessionFee: '30,000 RWF' })
    expect(within(summary()).queryByText('Rush edit')).not.toBeInTheDocument()

    await u.click(packageRadio('Extended'))

    expect(packageRadio('Extended')).toBeChecked()
    expect(packageRadio('Standard')).not.toBeChecked()
    expect(lines().slice(0, 2)).toEqual([
      ['Extended', '60,000 RWF'],
      ['Extra hour', '10,000 RWF'],
    ])
    expect(totals()).toEqual({
      total: '70,000 RWF',
      bookingFee: ['Booking fee (40%), paid now to secure your date', '28,000 RWF'],
      sessionFee: '42,000 RWF',
    })

    await u.click(addonCheckbox('Extra hour'))

    expect(totals()).toMatchObject({ total: '60,000 RWF', sessionFee: '36,000 RWF' })
    expect(lines()).toHaveLength(4)
  })

  it('shows 15,000 now at 30% and 35,000 after on the same 50,000 basket for a service overriding the rate', async () => {
    stubApi()
    await renderLoaded(WEDDINGS)
    const u = user()

    await u.click(packageRadio('Standard'))
    await u.click(addonCheckbox('Second shooter'))

    expect(totals()).toEqual({
      total: '50,000 RWF',
      bookingFee: ['Booking fee (30%), paid now to secure your date', '15,000 RWF'],
      sessionFee: '35,000 RWF',
    })
  })

  it('does not price add-ons ticked before a package is chosen, then includes them once it is', async () => {
    stubApi()
    await renderLoaded()
    const u = user()

    await u.click(addonCheckbox('Extra hour'))

    expect(addonCheckbox('Extra hour')).toBeChecked()
    expect(within(summary()).getByText(PROMPT)).toBeInTheDocument()
    expect(summary()).not.toHaveTextContent(/RWF/)

    await u.click(packageRadio('Mini'))

    expect(within(summary()).queryByText(PROMPT)).not.toBeInTheDocument()
    expect(totals()).toMatchObject({ total: '35,000 RWF', sessionFee: '21,000 RWF' })
  })

  it('lists the chosen add-ons in catalogue order, whatever order they were ticked in', async () => {
    stubApi()
    await renderLoaded()
    const u = user()

    await u.click(packageRadio('Mini'))
    await u.click(addonCheckbox('Rush edit'))
    await u.click(addonCheckbox('Extra hour'))

    expect(lines().slice(0, 3).map(([term]) => term)).toEqual(['Mini', 'Extra hour', 'Rush edit'])
  })

  it('can be driven by keyboard: arrow keys choose a package, Space ticks an add-on', async () => {
    stubApi()
    await renderLoaded()
    const u = user()

    await u.click(packageRadio('Mini'))
    await u.keyboard('{ArrowDown}')

    expect(packageRadio('Standard')).toBeChecked()
    expect(packageRadio('Standard')).toHaveFocus()

    addonCheckbox('Extra hour').focus()
    await u.keyboard(' ')

    expect(addonCheckbox('Extra hour')).toBeChecked()
    expect(totals()).toMatchObject({ total: '50,000 RWF', sessionFee: '30,000 RWF' })
  })
})

// --- The slot picker (plan.md Task 12) ------------------------------------------------------------

describe('the slot picker on the service page', () => {
  /** 08:00 on Thursday 1 October 2026 in Kigali. */
  const NOW = new Date('2026-10-01T06:00:00Z')
  const WEDNESDAY = 'Wednesday, 7 October 2026'

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function availabilityRequests(sent: string[]): [string | null, string | null][] {
    return sent
      .filter((url) => url.startsWith('/api/availability?'))
      .map((url) => {
        const query = new URLSearchParams(url.slice(url.indexOf('?') + 1))
        return [query.get('packageId'), query.get('month')]
      })
  }

  function listedTimes(): string[] {
    return within(screen.getByRole('list')).getAllByRole('button').map((button) => button.textContent ?? '')
  }

  it('says to choose a package first, and asks for no availability until one is chosen', async () => {
    const sent = stubApi()
    await renderLoaded()

    expect(screen.getByRole('heading', { level: 2, name: 'Choose a date and time' })).toBeInTheDocument()
    expect(screen.getByText('Choose a package to see available times.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Next month' })).not.toBeInTheDocument()

    await user().click(addonCheckbox('Extra hour'))

    expect(availabilityRequests(sent)).toEqual([])
  })

  it('requests the chosen package’s month and offers its dates', async () => {
    const sent = stubApi()
    await renderLoaded()

    await user().click(packageRadio('Standard'))

    expect(await screen.findByRole('button', { name: `${WEDNESDAY}, 3 times available` })).toBeEnabled()
    expect(screen.queryByText('Choose a package to see available times.')).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Choose a date and time' })).toBeInTheDocument()
    expect(availabilityRequests(sent)).toEqual([['p2', '2026-10']])
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('asks again for a longer package, keeps the date, and shows its fewer starts', async () => {
    const sent = stubApi()
    await renderLoaded()
    const u = user()
    await u.click(packageRadio('Mini'))
    await u.click(await screen.findByRole('button', { name: `${WEDNESDAY}, 5 times available` }))
    expect(listedTimes()).toEqual(['09:00', '09:30', '10:00', '10:30', '14:00'])

    await u.click(packageRadio('Extended'))

    expect(await screen.findByRole('button', { name: `${WEDNESDAY}, 2 times available` })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { level: 3, name: `Start times on ${WEDNESDAY}` })).toBeInTheDocument()
    expect(listedTimes()).toEqual(['09:00', '09:30'])
    expect(availabilityRequests(sent)).toEqual([
      ['p1', '2026-10'],
      ['p3', '2026-10'],
    ])
  })

  it('ends the chosen start at the chosen package’s duration, and follows a switch of package', async () => {
    stubApi()
    await renderLoaded()
    const u = user()
    await u.click(packageRadio('Standard'))
    await u.click(await screen.findByRole('button', { name: `${WEDNESDAY}, 3 times available` }))

    await u.click(screen.getByRole('button', { name: '09:30' }))

    expect(await screen.findByText(`Selected: ${WEDNESDAY}, 09:30 to 11:00, Kigali time`)).toBeInTheDocument()

    // Extended still offers 09:30, so the choice stands and runs to 11:30.
    await u.click(packageRadio('Extended'))

    expect(await screen.findByText(`Selected: ${WEDNESDAY}, 09:30 to 11:30, Kigali time`)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '09:30' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('drops the chosen start when the new package cannot have it', async () => {
    stubApi()
    await renderLoaded()
    const u = user()
    await u.click(packageRadio('Mini'))
    await u.click(await screen.findByRole('button', { name: `${WEDNESDAY}, 5 times available` }))
    await u.click(screen.getByRole('button', { name: '14:00' }))
    await screen.findByText(/^Selected: /)

    await u.click(packageRadio('Extended'))

    await screen.findByRole('button', { name: `${WEDNESDAY}, 2 times available` })
    await waitFor(() => expect(screen.queryByText(/^Selected: /)).not.toBeInTheDocument())
    expect(screen.queryByRole('button', { name: '14:00' })).not.toBeInTheDocument()
  })
})
