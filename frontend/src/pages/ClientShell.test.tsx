import { render, screen, within } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '@/i18n'
import { STORED_BOOKING_KEY, rememberBookingToken } from '@/lib/stored-booking'
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

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

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

  it('carries My booking, the admin login and the service list, and nothing else', () => {
    renderShell()

    const banner = screen.getByRole('banner')
    expect(within(banner).getByRole('link', { name: 'Bookly' })).toHaveAttribute('href', '/')
    expect(within(banner).getByRole('link', { name: 'Book now' })).toHaveAttribute('href', '/services')
    // Added 2026-09-25: the photographer's way into admin from the site.
    expect(within(banner).getByRole('link', { name: 'Admin login' })).toHaveAttribute('href', '/admin/login')
    // Added 2026-09-25, now that a public resend exists (item 4).
    expect(within(banner).getByRole('link', { name: 'My booking' })).toBeInTheDocument()
    expect(within(banner).getAllByRole('link')).toHaveLength(4)
  })

  it('keeps "Book now" last in the bar, the primary action after the quieter links', () => {
    renderShell()

    const links = within(screen.getByRole('banner')).getAllByRole('link').map((link) => link.textContent)
    expect(links).toEqual(['Bookly', 'My booking', 'Admin login', 'Book now'])
  })

  it('moves the admin login to the footer below sm, where the bar has no room for it (2026-09-25)', () => {
    renderShell()

    expect(within(screen.getByRole('banner')).getByRole('link', { name: 'Admin login' })).toHaveClass('hidden', 'sm:inline-flex')
    const footerLink = within(screen.getByRole('contentinfo')).getByRole('link', { name: 'Admin login' })
    expect(footerLink).toHaveAttribute('href', '/admin/login')
    expect(footerLink.closest('li')).toHaveClass('sm:hidden')
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

  it('sends My booking to the page that emails a new link when this device holds none', () => {
    renderShell()

    expect(within(screen.getByRole('banner')).getByRole('link', { name: 'My booking' })).toHaveAttribute('href', '/my-booking')
  })

  it('sends My booking to the booking this device last opened', () => {
    localStorage.setItem(STORED_BOOKING_KEY, 'aB3_x-9QzT7vL4pR8sK1nB6yH3cF5dG0wJe')
    renderShell()

    expect(within(screen.getByRole('banner')).getByRole('link', { name: 'My booking' })).toHaveAttribute(
      'href',
      '/booking/aB3_x-9QzT7vL4pR8sK1nB6yH3cF5dG0wJe',
    )
  })

  it('follows a link remembered after it rendered', () => {
    renderShell()

    act(() => rememberBookingToken('later-token-0123456789abcdef'))

    expect(within(screen.getByRole('banner')).getByRole('link', { name: 'My booking' })).toHaveAttribute('href', '/booking/later-token-0123456789abcdef')
  })

  it('still renders when storage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    renderShell()

    expect(within(screen.getByRole('banner')).getByRole('link', { name: 'My booking' })).toHaveAttribute('href', '/my-booking')
  })

  it('wraps every client page, not just the landing page', () => {
    renderShell('/services')

    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Services' })).toBeInTheDocument()
  })
})
