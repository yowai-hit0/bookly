import { Check } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { ApiError, UnauthenticatedError } from '@/admin/api'
import {
  FORM_FIELD_FOR,
  SETTINGS_FIELDS,
  type SettingsFormValues,
  settingsApi,
  settingsFormSchema,
  settingsFormValues,
} from '@/admin/settings'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { AdminField } from './AdminField'

/**
 * The five operating values (plan.md Task 8, spec P-30): the booking-fee rate,
 * the minimum notice, how long a hold lasts, the buffer between shoots, and how
 * long a photo link keeps working.
 *
 * The fee is typed as a percentage and stored as a rate, because "37.5%" is how
 * the photographer thinks about it and `0.375` is how the column stores it.
 *
 * A save sends all five. Changing one value does not disturb the others, and
 * nothing already booked moves: a booking snapshots its own fee and buffer when
 * it is created.
 */

export function AdminSettings() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [version, setVersion] = useState(0)
  /** The latest load; `values` is null when it failed. */
  const [loaded, setLoaded] = useState<{ values: SettingsFormValues | null } | null>(null)
  const [invalid, setInvalid] = useState<ReadonlySet<string>>(new Set())
  const [formError, setFormError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    settingsApi
      .load()
      .then(({ settings }) => !cancelled && setLoaded({ values: settingsFormValues(settings) }))
      .catch((error: unknown) => {
        if (cancelled) return
        if (error instanceof UnauthenticatedError) {
          navigate('/admin/login', { replace: true })
          return
        }
        setLoaded({ values: null })
      })
    return () => {
      cancelled = true
    }
  }, [version, navigate])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const input = Object.fromEntries(SETTINGS_FIELDS.map((field) => [field, String(data.get(field) ?? '')]))

    setFormError(null)
    setSaved(false)
    const parsed = settingsFormSchema.safeParse(input)
    if (!parsed.success) {
      setInvalid(new Set(parsed.error.issues.map((issue) => String(issue.path[0]))))
      return
    }
    setInvalid(new Set())

    setSaving(true)
    try {
      const { settings } = await settingsApi.save(parsed.data)
      // Redraw from what was stored, not from what was typed.
      setLoaded({ values: settingsFormValues(settings) })
      setSaved(true)
    } catch (error) {
      if (error instanceof UnauthenticatedError) {
        navigate('/admin/login', { replace: true })
        return
      }
      const named = error instanceof ApiError ? error.fields.map((field) => FORM_FIELD_FOR[field] ?? field) : []
      if (named.length > 0) setInvalid(new Set(named))
      else setFormError(t('admin:settings.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const values = loaded?.values ?? null

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <div className="flex flex-col">
        <h1 className="text-2xl font-semibold">{t('admin:settings.title')}</h1>
        <p className="text-muted-foreground text-sm">{t('admin:settings.intro')}</p>
      </div>

      {loaded === null && (
        <p className="text-muted-foreground text-sm" role="status">
          {t('admin:settings.loading')}
        </p>
      )}
      {loaded !== null && values === null && (
        <div className="flex items-center gap-2" role="alert">
          <p className="text-destructive text-sm">{t('admin:settings.loadFailed')}</p>
          <Button variant="outline" size="sm" onClick={() => setVersion((n) => n + 1)}>
            {t('admin:settings.retry')}
          </Button>
        </div>
      )}

      {values !== null && (
        <Card>
          <CardContent>
            <form
              className="flex flex-col gap-4"
              aria-label={t('admin:settings.title')}
              noValidate
              onSubmit={(event) => void onSubmit(event)}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                {SETTINGS_FIELDS.map((field) => (
                  <AdminField
                    key={field}
                    label={t(`admin:settings.fields.${field}`)}
                    hint={t(`admin:settings.hints.${field}`)}
                    error={invalid.has(field) ? t(`admin:settings.invalid.${field}`) : null}
                  >
                    {(props) => (
                      <Input
                        {...props}
                        name={field}
                        type="text"
                        inputMode="decimal"
                        className="max-w-40 tabular-nums"
                        // Keyed on the loaded values, so a save redraws the
                        // inputs from what the API stored.
                        key={values[field]}
                        defaultValue={values[field]}
                      />
                    )}
                  </AdminField>
                ))}
              </div>

              {saved && (
                <p className="flex items-center gap-1.5 text-sm" role="status">
                  <Check aria-hidden="true" className="text-primary size-4" />
                  {t('admin:settings.saved')}
                </p>
              )}
              {formError !== null && (
                <p className="text-destructive text-sm" role="alert">
                  {formError}
                </p>
              )}

              <Button type="submit" className="self-start" disabled={saving}>
                {saving ? t('admin:settings.saving') : t('admin:settings.save')}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </main>
  )
}
