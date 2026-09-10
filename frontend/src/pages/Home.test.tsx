import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '@/i18n'
import { Home } from './Home'

afterEach(() => {
  vi.unstubAllGlobals()
})

function stubHealth() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ ok: true }))),
  )
}

describe('Home', () => {
  it('renders copy through i18next rather than as literals', async () => {
    stubHealth()
    render(<Home />)

    expect(await screen.findByText('API: reachable')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Bookly' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Check again' })).toBeInTheDocument()
  })

  it('reaches the API at the same-origin path', async () => {
    stubHealth()
    render(<Home />)

    await screen.findByText('API: reachable')
    expect(fetch).toHaveBeenCalledWith('/api/health')
  })
})
