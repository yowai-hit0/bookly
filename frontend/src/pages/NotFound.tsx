import { FileQuestionMark } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { BackLink } from '@/components/ui/back-link'

export function NotFound() {
  const { t } = useTranslation()

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-2 p-6">
      <FileQuestionMark aria-hidden="true" className="text-muted-foreground mb-2 -ml-1 size-10" strokeWidth={1.5} />
      <h1 className="text-2xl font-semibold">{t('notFound:title')}</h1>
      <p className="text-muted-foreground text-sm">{t('notFound:body')}</p>
      <BackLink to="/services" className="mt-2">
        {t('services:allServices')}
      </BackLink>
    </main>
  )
}
