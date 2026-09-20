import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import '@/i18n'
import { NotFound } from './NotFound'

function renderNotFound() {
  const router = createMemoryRouter(
    [
      { path: '/services', element: <p>services list</p> },
      { path: '*', element: <NotFound /> },
    ],
    { initialEntries: ['/nowhere'] },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('NotFound', () => {
  it('renders its copy through i18next', () => {
    renderNotFound()

    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument()
    expect(screen.getByText('That page does not exist.')).toBeInTheDocument()
  })

  it('offers one way out: a link to the services list, named by the existing "All services" string', async () => {
    const router = renderNotFound()

    // The arrow icon is decorative, so the link's name is only the words.
    const link = screen.getByRole('link', { name: 'All services' })
    expect(link).toHaveAttribute('href', '/services')
    expect(screen.getAllByRole('link')).toHaveLength(1)

    await userEvent.setup({ delay: null }).click(link)

    expect(router.state.location.pathname).toBe('/services')
    expect(screen.getByText('services list')).toBeInTheDocument()
  })
})
