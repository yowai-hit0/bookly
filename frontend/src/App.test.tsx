import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('App', () => {
  it('reports the API as reachable once /api/health answers', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ ok: true }))),
    )

    render(<App />)

    expect(await screen.findByText('API: reachable')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith('/api/health')
  })

  it('renders the shadcn button', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ ok: true }))),
    )

    render(<App />)

    expect(screen.getByRole('button', { name: 'Check again' })).toBeInTheDocument()
  })
})
