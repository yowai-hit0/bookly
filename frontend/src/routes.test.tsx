import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/i18n'
import { routes } from '@/routes'

function renderAt(path: string) {
  return render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />)
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ ok: true }))),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('routing', () => {
  it('serves the home page from a plain path', async () => {
    renderAt('/')
    expect(await screen.findByRole('heading', { name: 'Bookly' })).toBeInTheDocument()
  })

  it('has no locale-prefixed route — /en is a 404, not the home page', () => {
    renderAt('/en')
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  })

  it('has no locale-prefixed route — /en/ is a 404 too', () => {
    renderAt('/en/')
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  })

  it('falls through to the not-found page for an unknown path', () => {
    renderAt('/nothing-here')
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  })

  it('serves the public service list from /services (plan.md Task 11)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ services: [] }))))
    renderAt('/services')
    expect(await screen.findByRole('heading', { level: 1, name: 'Services' })).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith('/api/services', expect.anything())
  })

  it('serves a service page from /services/:slug (plan.md Task 11)', async () => {
    const service = { id: 's1', slug: 'portraits', nameEn: 'Portraits', descriptionEn: null, coverImageUrl: null, packages: [], addons: [], bookingFeeRate: 0.4 }
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ service }))))
    renderAt('/services/portraits')
    expect(await screen.findByRole('heading', { level: 1, name: 'Portraits' })).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith('/api/services/portraits', expect.anything())
  })

  it('has nothing below a service page — /services/portraits/extra is a 404', () => {
    renderAt('/services/portraits/extra')
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  })

  it('declares the two public service paths', () => {
    const paths = routes.map((route) => route.path)
    expect(paths).toContain('/services')
    expect(paths).toContain('/services/:slug')
  })

  it('declares no route whose first segment is a locale', () => {
    const firstSegments = routes
      .map((route) => route.path?.split('/').filter(Boolean)[0])
      .filter((segment): segment is string => segment !== undefined)
    expect(firstSegments).not.toContain('en')
    expect(firstSegments).not.toContain('fr')
  })
})
