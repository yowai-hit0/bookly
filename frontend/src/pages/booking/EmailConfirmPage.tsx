import { CircleCheck, Unlink } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { confirmEmailChange } from '@/catalogue/booking-access'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import { StatusIcon } from '@/components/ui/status-icon'

/**
 * `/email-confirm/:token`: where the link in a contact-email confirmation lands
 * (docs/prompts/client-access-and-admin-polish.md, item 6).
 *
 * Opening the page changes nothing: the change is made by the button. Mail
 * scanners open links, and some run scripts, so a change confirmed on load
 * could be confirmed by a machine. An unknown, expired, used or replaced link
 * is one "not valid" page, as a dead booking link is.
 */

type Status = 'idle' | 'confirming' | 'confirmed' | 'invalid' | 'failed'

export function EmailConfirmPage() {
  const { t } = useTranslation()
  const { token = '' } = useParams()
  const [status, setStatus] = useState<Status>('idle')

  async function confirm() {
    if (status === 'confirming') return
    setStatus('confirming')
    setStatus(await confirmEmailChange(token))
  }

  if (status === 'invalid') {
    return (
      <main className="mx-auto flex max-w-xl flex-col gap-3 px-4 py-8 text-pretty">
        <StatusIcon icon={Unlink} tone="neutral" />
        <h1 className="text-2xl font-semibold text-balance">{t('emailConfirm:invalid.title')}</h1>
        <p className="text-muted-foreground text-sm">{t('emailConfirm:invalid.body')}</p>
      </main>
    )
  }

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-8 text-pretty">
      <h1 className="text-3xl font-semibold text-balance">{t('emailConfirm:title')}</h1>
      {status === 'confirmed' ? (
        <Callout icon={CircleCheck} role="status">
          <p>{t('emailConfirm:done')}</p>
        </Callout>
      ) : (
        <>
          <p className="text-muted-foreground">{t('emailConfirm:intro')}</p>
          {status === 'failed' && (
            <p className="text-destructive text-sm" role="alert">
              {t('emailConfirm:failed')}
            </p>
          )}
          <Button className="self-start" aria-disabled={status === 'confirming'} onClick={() => void confirm()}>
            {status === 'confirming' ? t('emailConfirm:confirming') : t('emailConfirm:confirm')}
          </Button>
        </>
      )}
    </main>
  )
}
