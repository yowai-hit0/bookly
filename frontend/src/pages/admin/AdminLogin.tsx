import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { apiUrl } from '@/admin/api'
import { saveSession } from '@/admin/session'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Status = 'idle' | 'submitting' | 'invalid' | 'failed'

type LoginResponse = { token: string; expiresAt: string }

/**
 * Email and password (spec A-11). The API answers an unknown email, a wrong
 * password and a locked account identically, so this page cannot and does not
 * tell them apart.
 */
export function AdminLogin() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>('idle')

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setStatus('submitting')

    try {
      const res = await fetch(apiUrl('/admin/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
      })
      if (res.status === 400 || res.status === 401) {
        setStatus('invalid')
        return
      }
      if (!res.ok) {
        setStatus('failed')
        return
      }
      const body = (await res.json()) as LoginResponse
      saveSession({ token: body.token, expiresAt: body.expiresAt })
      navigate('/admin/calendar', { replace: true })
    } catch {
      setStatus('failed')
    }
  }

  const message =
    status === 'invalid' ? t('admin:signIn.invalid') : status === 'failed' ? t('admin:signIn.failed') : null

  return (
    <main className="mx-auto flex min-h-svh max-w-sm flex-col justify-center p-6">
      <Card>
        <CardHeader>
          <CardTitle>
            <h1>{t('admin:signIn.title')}</h1>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={onSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="admin-email">{t('admin:signIn.email')}</Label>
              <Input id="admin-email" name="email" type="email" autoComplete="username" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="admin-password">{t('admin:signIn.password')}</Label>
              <Input
                id="admin-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>
            {message !== null && (
              <p className="text-destructive text-sm" role="alert">
                {message}
              </p>
            )}
            <Button type="submit" disabled={status === 'submitting'}>
              {status === 'submitting' ? t('admin:signIn.submitting') : t('admin:signIn.submit')}
            </Button>
            {/* The reset page asks for the address itself; this link carries nothing. */}
            <Link to="/admin/reset-password" className="text-muted-foreground text-sm underline-offset-4 hover:underline">
              {t('admin:signIn.forgot')}
            </Link>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
