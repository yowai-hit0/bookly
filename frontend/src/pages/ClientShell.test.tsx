import { render, screen, within } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import '@/i18n'
import { ClientShell } from './ClientShell'

/**
 * The header and footer are structural: three e2e specs read `main`, `dl dt`
 * and page-wide button and radio counts, and all of them break if the shell
 * adds a second landmark or a control. These assertions are the guard.
 */

function renderShell(path = '/') {
  const router = createMemoryRouter(
    [
      {
        element: <ClientShell />,
        children: [
          { path: '/', element: <main><h1>A page</h1></main> },
          { path: '/services', element: <main><h1>Services</h1></main> },
        ],
      },
    ],
    { initialEntries: [path] },
  )
  return render(<RouterProvider router={router} />)
}

describe('the client shell', () => {
  it('puts the header and footer beside the page’s own main, never around it', () => {
    const { container } = renderShell()

    expect(container.querySelectorAll('main')).toHaveLength(1)
    const banner = screen.getByRole('banner')
    const main = screen.getByRole('main')
    const footer = screen.getByRole('contentinfo')
    expect(banner.contains(main)).toBe(false)
    expect(footer.contains(main)).toBe(false)
    expect(main.closest('#main-content')).not.toBeNull()
  })

  it('opens with a skip link that targets the outlet container', () => {
    renderShell()

    const skip = screen.getByRole('link', { name: 'Skip to content' })
    expect(skip).toHaveAttribute('href', '#main-content')
    // First focusable in the document, or it skips nothing.
    const focusable = document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])')
    expect(focusable[0]).toBe(skip)

    const target = document.querySelector('#main-content')
    expect(target).toHaveAttribute('tabindex', '-1')
  })

  it('carries one nav link, to the service list', () => {
    renderShell()

    const banner = screen.getByRole('banner')
    expect(within(banner).getByRole('link', { name: 'Bookly' })).toHaveAttribute('href', '/')
    expect(within(banner).getByRole('link', { name: 'Book now' })).toHaveAttribute('href', '/services')
    // "My booking" needs a public resend endpoint, which does not exist
    // (decided 2026-09-21). Until it does, the header must not offer it.
    expect(within(banner).queryByRole('link', { name: /my booking/i })).not.toBeInTheDocument()
    expect(within(banner).getAllByRole('link')).toHaveLength(2)
  })

  it('adds no button and no form control anywhere: the e2e suite counts these page-wide', () => {
    const { container } = renderShell()

    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
    // checkout.spec.ts counts `input:disabled, [aria-disabled="true"]`; that
    // assertion is scoped to `main`, so the chrome's side of it is proved here.
    expect(container.querySelectorAll('input, select, textarea')).toHaveLength(0)
    expect(container.querySelectorAll('[aria-disabled="true"]')).toHaveLength(0)
  })

  it('puts no definition list in the footer: booking.spec.ts reads `dl dt` page-wide', () => {
    const { container } = renderShell()

    expect(within(screen.getByRole('contentinfo')).queryAllByRole('definition')).toHaveLength(0)
    expect(container.querySelectorAll('footer dl')).toHaveLength(0)
  })

  it('never names a link "All services": three e2e specs match that name page-wide', () => {
    renderShell()

    expect(screen.queryByRole('link', { name: /all services/i })).not.toBeInTheDocument()
    const footer = screen.getByRole('contentinfo')
    expect(within(footer).getByRole('link', { name: 'Browse services' })).toHaveAttribute('href', '/services')
    expect(within(footer).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/')
  })

  it('keeps the words the payment and price specs assert are absent', () => {
    renderShell()

    for (const chrome of [screen.getByRole('banner'), screen.getByRole('contentinfo')]) {
      expect(chrome.textContent ?? '').not.toMatch(/processing|airtel|card/i)
    }
  })

  it('wraps every client page, not just the landing page', () => {
    renderShell('/services')

    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Services' })).toBeInTheDocument()
  })
})
