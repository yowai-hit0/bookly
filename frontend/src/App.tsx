import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { env } from '@/env'

type Health = { ok: boolean }

function App() {
  const [health, setHealth] = useState<Health | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${env.VITE_API_BASE_URL}/health`)
      .then((res) => res.json() as Promise<Health>)
      .then(setHealth)
      .catch((err: unknown) => setError(String(err)))
  }, [])

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Bookly</h1>
      <p className="text-muted-foreground text-sm" role="status">
        API: {error ?? (health ? 'reachable' : 'checking…')}
      </p>
      <Button onClick={() => window.location.reload()}>Check again</Button>
    </main>
  )
}

export default App
