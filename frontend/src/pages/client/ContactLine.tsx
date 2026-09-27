import { useTranslation } from 'react-i18next'
import { contactLinks, PHOTOGRAPHER_CONTACT } from '@/lib/contact'
import { cn } from '@/lib/utils'

/**
 * "Questions?" and the photographer's contact channels that exist
 * (`lib/contact.ts`; client-front.md 5.8), for the price summary. Renders
 * nothing while no channel is set. Links, never buttons, and no `dl`: the
 * e2e suite counts the summary's buttons and reads `dl dt` page-wide.
 */
export function ContactLine({ className }: { className?: string }) {
  const { t } = useTranslation()
  const links = contactLinks(PHOTOGRAPHER_CONTACT)
  if (links.length === 0) return null

  return (
    <p className={cn('text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem]', className)}>
      <span>{t('shell:contact.questions')}</span>
      {links.map((link, index) => (
        <span key={link.kind} className="inline-flex items-center gap-2">
          {index > 0 && <span aria-hidden="true">·</span>}
          <a
            href={link.href}
            aria-label={`${t(`shell:contact.${link.kind}`)}: ${link.value}`}
            className="text-console-link hover:text-console-link-hover inline-flex min-h-6 items-center rounded-xs underline-offset-4 hover:underline pointer-coarse:min-h-11"
          >
            {link.kind === 'email' ? link.value : `${t(`shell:contact.${link.kind}`)} ${link.value}`}
          </a>
        </span>
      ))}
    </p>
  )
}
