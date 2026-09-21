import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/i18n'
import { Home } from './Home'

/**
 * The landing page replaced an API-status stub on 2026-09-21, so none of the
 * old assertions survived. What matters now: it sends people to `/services`,
 * it shows the API's own services rather than any of its own, it says the
 * unfavourable term out loud, and a failed fetch leaves a working page.
 */

const SERVICES = [
  { id: 's1', slug: 'portraits', nameEn: 'Portraits', descriptionEn: null, coverImageUrl: null, packages: [{ id: 'p1', nameEn: 'Mini', priceRwf: 25_000, durationMinutes: 60, photoCount: 10 }] },
  { id: 's2', slug: 'weddings', nameEn: 'Weddings', descriptionEn: null, coverImageUrl: null, packages: [{ id: 'p2', nameEn: 'Full', priceRwf: 40_000, durationMinutes: 240, photoCount: 80 }] },
  { id: 's3', slug: 'events', nameEn: 'Events', descriptionEn: null, coverImageUrl: null, packages: [] },
  { id: 's4', slug: 'products', nameEn: 'Products', descriptionEn: null, coverImageUrl: null, packages: [] },
]

function stubServices(services: unknown[] = SERVICES) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ services }))),
  )
}

function renderHome() {
  return render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  stubServices()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the landing page', () => {
  it('leads with one h1 and a call to action into the service list', async () => {
    renderHome()

    const headings = await screen.findAllByRole('heading', { level: 1 })
    expect(headings).toHaveLength(1)
    expect(headings[0]).toHaveTextContent('Book a photographer, and know the price before you do.')

    // "Book now" is in the hero and the closing band; both go to the same place.
    const bookNow = screen.getAllByRole('link', { name: 'Book now' })
    expect(bookNow).toHaveLength(2)
    for (const link of bookNow) expect(link).toHaveAttribute('href', '/services')
  })

  it('previews the first three services the API lists, and nothing of its own', async () => {
    renderHome()

    expect(await screen.findByRole('link', { name: 'Portraits' })).toHaveAttribute('href', '/services/portraits')
    expect(screen.getByRole('link', { name: 'Weddings' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Events' })).toBeInTheDocument()
    // The fourth is the list page's job, not the landing page's.
    expect(screen.queryByRole('link', { name: 'Products' })).not.toBeInTheDocument()
    expect(screen.getByText('From 25,000 RWF')).toBeInTheDocument()
  })

  it('reaches the same endpoint the service list uses', async () => {
    renderHome()

    await screen.findByRole('link', { name: 'Portraits' })
    expect(fetch).toHaveBeenCalledWith('/api/services', expect.anything())
  })

  it('never names a service the API did not send', async () => {
    stubServices([])
    renderHome()

    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'What you can book' })).not.toBeInTheDocument()
  })

  it('drops the preview silently when the API fails: no alert, no retry, and the page still works', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 500 })),
    )
    renderHome()

    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'What you can book' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Book now' })).toHaveLength(2)
  })

  it('explains the booking fee is not refunded, rather than leaving it to checkout', async () => {
    renderHome()

    const trust = (await screen.findByRole('heading', { name: 'What you can count on' })).closest('section')
    expect(trust).not.toBeNull()
    expect(within(trust as HTMLElement).getByRole('heading', { name: 'The booking fee is not refunded' })).toBeInTheDocument()
    expect(within(trust as HTMLElement).getByText(/the booking fee stays with the photographer/i)).toBeInTheDocument()
  })

  it('lays the four booking steps out in order, as a list', async () => {
    renderHome()

    const how = (await screen.findByRole('heading', { name: 'How booking works' })).closest('section')
    const steps = within(how as HTMLElement).getAllByRole('listitem')
    expect(steps.map((step) => step.querySelector('h3')?.textContent)).toEqual([
      'Choose a service',
      'Pick a time',
      'Pay the booking fee',
      'Get your link',
    ])
  })
})
