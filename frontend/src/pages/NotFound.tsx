import { ArrowLeft, FileQuestionMark } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

export function NotFound() {
  const { t } = useTranslation()

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-2 p-6">
      <FileQuestionMark aria-hidden="true" className="text-muted-foreground mb-2 -ml-1 size-10" strokeWidth={1.5} />
      <h1 className="text-2xl font-semibold">{t('notFound:title')}</h1>
      <p className="text-muted-foreground text-sm">{t('notFound:body')}</p>
      <Link
        to="/services"
        className="text-muted-foreground focus-visible:outline-ring mt-2 inline-flex min-h-6 items-center gap-1.5 self-start rounded-sm text-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 pointer-coarse:min-h-11"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t('services:allServices')}
      </Link>
    </main>
  )
}
