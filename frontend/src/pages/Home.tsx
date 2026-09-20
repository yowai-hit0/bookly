import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { env } from '@/env'
import { cn } from '@/lib/utils'

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
  const failed = error !== null

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-3xl font-semibold">{t('common:appName')}</h1>
      {/* The dot only repeats what the words say; the text is the signal. The raw error can be a long token, so it wraps anywhere. */}
      <p className={cn('flex items-start gap-2 text-sm', failed ? 'text-destructive' : 'text-muted-foreground')} role="status">
        <span
          aria-hidden="true"
          className={cn(
            'mt-1.5 size-2 shrink-0 rounded-full transition-colors duration-200 motion-reduce:transition-none',
            failed ? 'bg-destructive' : health ? 'bg-primary' : 'bg-muted-foreground',
          )}
        />
        <span className="min-w-0 wrap-anywhere">{t('home:apiStatus', { status })}</span>
      </p>
      <Button className="self-start" onClick={() => window.location.reload()}>
        {t('home:recheck')}
      </Button>
    </main>
  )
}
