import { FileQuestionMark } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { BackLink } from '@/components/ui/back-link'
import { StatusIcon } from '@/components/ui/status-icon'

export function NotFound() {
  const { t } = useTranslation()

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-2 p-6">
      <StatusIcon icon={FileQuestionMark} tone="neutral" />
      <h1 className="text-2xl font-semibold text-balance">{t('notFound:title')}</h1>
      <p className="text-muted-foreground text-sm">{t('notFound:body')}</p>
      <BackLink to="/services" className="mt-2">
        {t('services:allServices')}
      </BackLink>
    </main>
  )
}
