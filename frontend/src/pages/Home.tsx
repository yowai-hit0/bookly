import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { env } from '@/env'

type Health = { ok: boolean }

export function Home() {
  const { t } = useTranslation()
  const [health, setHealth] = useState<Health | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${env.VITE_API_BASE_URL}/health`)
      .then((res) => res.json() as Promise<Health>)
      .then(setHealth)
      .catch((err: unknown) => setError(String(err)))
  }, [])

  const status = error ?? (health ? t('home:reachable') : t('home:checking'))

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">{t('common:appName')}</h1>
      <p className="text-muted-foreground text-sm" role="status">
        {t('home:apiStatus', { status })}
      </p>
      <Button onClick={() => window.location.reload()}>{t('home:recheck')}</Button>
    </main>
  )
}
