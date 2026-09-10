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

  it('declares no route whose first segment is a locale', () => {
    const firstSegments = routes
      .map((route) => route.path?.split('/').filter(Boolean)[0])
      .filter((segment): segment is string => segment !== undefined)
    expect(firstSegments).not.toContain('en')
    expect(firstSegments).not.toContain('fr')
  })
})
