import { MailCheck, TriangleAlert } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router'
import { apiUrl } from '@/admin/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { AdminField } from './AdminField'

/**
 * `/admin/reset-password` (plan.md Task 7, spec §6.23, A-11). One route, two
 * jobs, told apart by whether the emailed link carried a token:
 *
 * - no token: ask for the email and have the API send the link;
 * - token: choose the new password and consume it.
 *
 * The token arrives in the URL **fragment** (`#token=…`), which browsers never
 * put in a request, so it reaches no server log, proxy or referrer header. It
 * is read here and sent once, in a POST body. Nothing stores it and no
 * navigation carries it.
 *
 * The request form always says the same thing, whether or not the address can
 * sign in here: the API answers 202 either way, so this page cannot and does
 * not reveal who has an account.
 */

/** Mirrors the API's own floor (`MIN_NEW_PASSWORD_LENGTH`). */
const MIN_PASSWORD_LENGTH = 12

type RequestStatus = 'idle' | 'submitting' | 'sent' | 'failed'
type ConfirmStatus = 'idle' | 'submitting' | 'done' | 'invalidToken' | 'failed'

export function AdminResetPassword() {
  const { t } = useTranslation()
  const { hash } = useLocation()
  const token = new URLSearchParams(hash.replace(/^#/, '')).get('token')

  return (
    <main className="mx-auto flex min-h-svh max-w-sm flex-col justify-center gap-4 p-6">
      {/* Same frame as `/admin/login`: a photographer arriving from there must
          land somewhere that visibly matches, not something phishing-shaped. */}
      <span className="font-heading text-foreground/80 self-center text-lg font-semibold">
        {t('common:appName')}
      </span>
      {token === null || token === '' ? <RequestLink /> : <ChoosePassword token={token} />}
    </main>
  )
}

/** Step one: ask the API to email a link. */
function RequestLink() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<RequestStatus>('idle')

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const email = String(new FormData(event.currentTarget).get('email') ?? '')
    setStatus('submitting')

    try {
      const res = await fetch(apiUrl('/admin/auth/password-reset/request'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      // 202 whether or not the address is the admin's; anything else is a fault
      // on our side, which is worth saying because no email is coming.
      setStatus(res.ok ? 'sent' : 'failed')
    } catch {
      setStatus('failed')
    }
  }

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle>
          <h1 className="text-xl">{t('admin:resetPassword.requestTitle')}</h1>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {status === 'sent' ? (
          <p className="flex items-start gap-2 text-sm" role="status">
            <MailCheck aria-hidden="true" className="text-primary mt-0.5 size-4 shrink-0" />
            {t('admin:resetPassword.requestSent')}
          </p>
        ) : (
          <>
            <p className="text-muted-foreground text-sm">{t('admin:resetPassword.requestBody')}</p>
            <form className="flex flex-col gap-4" noValidate onSubmit={(event) => void onSubmit(event)}>
              <AdminField label={t('admin:resetPassword.email')}>
                {(props) => <Input {...props} name="email" type="email" autoComplete="username" required />}
              </AdminField>
              {status === 'failed' && (
                <p className="text-destructive text-sm" role="alert">
                  {t('admin:resetPassword.requestFailed')}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={status === 'submitting'}>
                {status === 'submitting'
                  ? t('admin:resetPassword.requestSubmitting')
                  : t('admin:resetPassword.requestSubmit')}
              </Button>
            </form>
          </>
        )}
        <Link to="/admin/login" className="text-muted-foreground text-sm underline-offset-4 hover:underline">
          {t('admin:resetPassword.backToSignIn')}
        </Link>
      </CardContent>
    </Card>
  )
}

/** Step two: the emailed link carried a token, so choose the new password. */
function ChoosePassword({ token }: { token: string }) {
  const { t } = useTranslation()
  const [status, setStatus] = useState<ConfirmStatus>('idle')
  const [invalid, setInvalid] = useState<'tooShort' | 'mismatch' | null>(null)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const newPassword = String(data.get('newPassword') ?? '')
    const repeated = String(data.get('confirmPassword') ?? '')

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setInvalid('tooShort')
      return
    }
    if (newPassword !== repeated) {
      setInvalid('mismatch')
      return
    }
    setInvalid(null)
    setStatus('submitting')

    try {
      const res = await fetch(apiUrl('/admin/auth/password-reset/confirm'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      })
      if (res.status === 204) {
        setStatus('done')
        return
      }
      // A 400 here is the token: the length is checked above, so the only
      // malformed body this page can send is one with a spent or expired token.
      setStatus(res.status === 400 ? 'invalidToken' : 'failed')
    } catch {
      setStatus('failed')
    }
  }

  if (status === 'done') {
    return (
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>
            <h1 className="text-xl">{t('admin:resetPassword.doneTitle')}</h1>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm" role="status">
            {t('admin:resetPassword.doneBody')}
          </p>
          {/* The one shape where the way out is a button: the job is finished
              and there is exactly one next thing to do. */}
          <Button asChild className="self-start">
            <Link to="/admin/login">{t('admin:resetPassword.backToSignIn')}</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle>
          <h1 className="text-xl">{t('admin:resetPassword.chooseTitle')}</h1>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-muted-foreground text-sm">{t('admin:resetPassword.chooseBody')}</p>
        <form className="flex flex-col gap-4" noValidate onSubmit={(event) => void onSubmit(event)}>
          <AdminField
            label={t('admin:resetPassword.newPassword')}
            hint={t('admin:resetPassword.passwordHint')}
            error={invalid === 'tooShort' ? t('admin:resetPassword.tooShort') : null}
          >
            {(props) => <Input {...props} name="newPassword" type="password" autoComplete="new-password" required />}
          </AdminField>
          <AdminField
            label={t('admin:resetPassword.confirmPassword')}
            error={invalid === 'mismatch' ? t('admin:resetPassword.mismatch') : null}
          >
            {(props) => (
              <Input {...props} name="confirmPassword" type="password" autoComplete="new-password" required />
            )}
          </AdminField>

          {(status === 'invalidToken' || status === 'failed') && (
            <p className="text-destructive flex items-start gap-2 text-sm" role="alert">
              {/* The dead end gets an icon; a plain retry-worthy failure does not. */}
              {status === 'invalidToken' && (
                <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              )}
              {t(status === 'invalidToken' ? 'admin:resetPassword.invalidToken' : 'admin:resetPassword.chooseFailed')}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={status === 'submitting'}>
            {status === 'submitting'
              ? t('admin:resetPassword.chooseSubmitting')
              : t('admin:resetPassword.chooseSubmit')}
          </Button>
        </form>
        <Link to="/admin/login" className="text-muted-foreground text-sm underline-offset-4 hover:underline">
          {t('admin:resetPassword.backToSignIn')}
        </Link>
      </CardContent>
    </Card>
  )
}
