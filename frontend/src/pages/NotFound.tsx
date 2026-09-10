import { useTranslation } from 'react-i18next'

export function NotFound() {
  const { t } = useTranslation()

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-2 p-6">
      <h1 className="text-2xl font-semibold">{t('notFound:title')}</h1>
      <p className="text-muted-foreground text-sm">{t('notFound:body')}</p>
    </main>
  )
}
