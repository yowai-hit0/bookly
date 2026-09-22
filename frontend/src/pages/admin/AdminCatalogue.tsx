import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { ApiError, UnauthenticatedError } from '@/admin/api'
import {
  type AdminAddon,
  type AdminPackage,
  type CatalogueData,
  type CatalogueService,
  type DurationWarning,
  type PackageSaved,
  addonFormSchema,
  addonFormValues,
  catalogueApi,
  formatMinuteOfDay,
  packageFormSchema,
  packageFormValues,
  serviceFormSchema,
  serviceFormValues,
} from '@/admin/catalogue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatMoney } from '@/lib/format'
import { EntityForm, type FieldSpec } from './EntityForm'

/**
 * The catalogue CMS (plan.md Task 10, spec §3.4, §6.8, §6.14): services, their
 * packages and add-ons, and the add-ons offered on every service.
 *
 * One form is open at a time. After any save the whole catalogue is fetched
 * again -- it is a few dozen rows -- so what is shown is always what is stored.
 * Reordering is the display-order field; deactivating is how something stops
 * being sold, and delete is refused by the API for anything in use.
 */

const SERVICE_FIELDS: readonly FieldSpec[] = [
  { name: 'nameEn', kind: 'text' },
  { name: 'slug', kind: 'text', hint: true },
  { name: 'descriptionEn', kind: 'textarea' },
  { name: 'coverImageUrl', kind: 'text', hint: true },
  { name: 'bookingFeePercent', kind: 'number', hint: true },
  { name: 'sortOrder', kind: 'number', hint: true },
  { name: 'isActive', kind: 'checkbox' },
]

const PACKAGE_FIELDS: readonly FieldSpec[] = [
  { name: 'nameEn', kind: 'text' },
  { name: 'priceRwf', kind: 'number', hint: true },
  { name: 'photoCount', kind: 'number' },
  { name: 'durationMinutes', kind: 'number' },
  { name: 'descriptionEn', kind: 'textarea' },
  { name: 'sortOrder', kind: 'number', hint: true },
  { name: 'isActive', kind: 'checkbox' },
]

const ADDON_FIELDS: readonly FieldSpec[] = [
  { name: 'nameEn', kind: 'text' },
  { name: 'priceRwf', kind: 'number', hint: true },
  { name: 'sortOrder', kind: 'number', hint: true },
  { name: 'isActive', kind: 'checkbox' },
]

/** Which form is open: `service:new`, `service:<id>`, `package:new:<serviceId>`, … */
type Editing = string | null

export function AdminCatalogue() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [version, setVersion] = useState(0)
  /** The latest load; `data` is null when it failed. Kept across reloads, so a
   *  save does not blank the page while the fresh copy arrives. */
  const [loaded, setLoaded] = useState<{ data: CatalogueData | null } | null>(null)
  const [editing, setEditing] = useState<Editing>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<Record<string, DurationWarning>>({})

  useEffect(() => {
    let cancelled = false
    catalogueApi
      .load()
      .then((data) => !cancelled && setLoaded({ data }))
      .catch((error: unknown) => {
        if (cancelled) return
        if (error instanceof UnauthenticatedError) {
          navigate('/admin/login', { replace: true })
          return
        }
        setLoaded({ data: null })
      })
    return () => {
      cancelled = true
    }
  }, [version, navigate])

  const reload = () => setVersion((n) => n + 1)

  /** A save from an open form: close it and refetch. Errors stay in the form. */
  async function saved(action: Promise<unknown>) {
    await action
    setEditing(null)
    reload()
  }

  function rememberWarning({ package: pkg, warning }: PackageSaved) {
    setWarnings((current) => {
      const next = { ...current }
      if (warning === null) delete next[pkg.id]
      else next[pkg.id] = warning
      return next
    })
  }

  /** A one-click action (activate, deactivate, delete). */
  async function act(action: () => Promise<unknown>) {
    setActionError(null)
    try {
      await action()
      reload()
    } catch (error) {
      if (error instanceof UnauthenticatedError) {
        navigate('/admin/login', { replace: true })
        return
      }
      const inUse = error instanceof ApiError && error.message === 'in_use'
      setActionError(t(inUse ? 'admin:catalogue.inUse' : 'admin:catalogue.actionFailed'))
    }
  }

  function remove(name: string, action: () => Promise<unknown>) {
    if (window.confirm(t('admin:catalogue.confirmDelete', { name }))) void act(action)
  }

  function rowActions(name: string, isActive: boolean, key: string, toggle: () => Promise<unknown>, del: () => Promise<unknown>) {
    return (
      <div className="flex flex-wrap gap-1">
        <Button size="sm" variant="outline" aria-label={t('admin:catalogue.editNamed', { name })} onClick={() => setEditing(key)}>
          {t('admin:catalogue.edit')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          aria-label={t(isActive ? 'admin:catalogue.deactivateNamed' : 'admin:catalogue.activateNamed', { name })}
          onClick={() => void act(toggle)}
        >
          {t(isActive ? 'admin:catalogue.deactivate' : 'admin:catalogue.activate')}
        </Button>
        <Button size="sm" variant="destructive" aria-label={t('admin:catalogue.deleteNamed', { name })} onClick={() => remove(name, del)}>
          {t('admin:catalogue.delete')}
        </Button>
      </div>
    )
  }

  function statusBadge(isActive: boolean) {
    return <Badge variant={isActive ? 'default' : 'outline'}>{t(isActive ? 'admin:catalogue.active' : 'admin:catalogue.inactive')}</Badge>
  }

  function packageRow(pkg: AdminPackage) {
    const key = `package:${pkg.id}`
    if (editing === key) {
      return (
        <li key={pkg.id}>
          <EntityForm
            title={t('admin:catalogue.editPackage')}
            submitLabel={t('admin:catalogue.save')}
            fields={PACKAGE_FIELDS}
            values={packageFormValues(pkg)}
            schema={packageFormSchema}
            onSave={(payload) => saved(catalogueApi.updatePackage(pkg.id, payload).then(rememberWarning))}
            onCancel={() => setEditing(null)}
          />
        </li>
      )
    }
    const warning = warnings[pkg.id]
    return (
      <li key={pkg.id} className="flex flex-col gap-1 border-b py-2 last:border-b-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{pkg.nameEn}</span>
            {statusBadge(pkg.isActive)}
            <span className="text-muted-foreground text-sm">
              {formatMoney(pkg.priceRwf)} · {t('admin:catalogue.photos', { count: pkg.photoCount })} ·{' '}
              {t('admin:catalogue.duration', { minutes: pkg.durationMinutes })} · {t('admin:catalogue.order', { order: pkg.sortOrder })}
            </span>
          </div>
          {rowActions(
            pkg.nameEn,
            pkg.isActive,
            key,
            () => catalogueApi.updatePackage(pkg.id, { isActive: !pkg.isActive }).then(rememberWarning),
            () => catalogueApi.deletePackage(pkg.id),
          )}
        </div>
        {warning !== undefined && (
          <p className="text-destructive text-sm" role="alert">
            {warning.longestWindow === null
              ? t('admin:catalogue.durationWarningNoHours', { name: pkg.nameEn })
              : t('admin:catalogue.durationWarning', {
                  name: pkg.nameEn,
                  minutes: pkg.durationMinutes,
                  opens: formatMinuteOfDay(warning.longestWindow.opensMinute),
                  closes: formatMinuteOfDay(warning.longestWindow.closesMinute),
                  longest: warning.longestWindow.closesMinute - warning.longestWindow.opensMinute,
                })}
          </p>
        )}
      </li>
    )
  }

  function addonRow(addon: AdminAddon) {
    const key = `addon:${addon.id}`
    if (editing === key) {
      return (
        <li key={addon.id}>
          <EntityForm
            title={t('admin:catalogue.editAddon')}
            submitLabel={t('admin:catalogue.save')}
            fields={ADDON_FIELDS}
            values={addonFormValues(addon)}
            schema={addonFormSchema}
            onSave={(payload) => saved(catalogueApi.updateAddon(addon.id, payload))}
            onCancel={() => setEditing(null)}
          />
        </li>
      )
    }
    return (
      <li key={addon.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 last:border-b-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{addon.nameEn}</span>
          {statusBadge(addon.isActive)}
          <span className="text-muted-foreground text-sm">
            {formatMoney(addon.priceRwf)} · {t('admin:catalogue.order', { order: addon.sortOrder })}
          </span>
        </div>
        {rowActions(
          addon.nameEn,
          addon.isActive,
          key,
          () => catalogueApi.updateAddon(addon.id, { isActive: !addon.isActive }),
          () => catalogueApi.deleteAddon(addon.id),
        )}
      </li>
    )
  }

  /** The add-on list plus its "Add add-on" control, for one service or for all. */
  function addonSection(serviceId: string | null, addons: AdminAddon[], heading: string) {
    const newKey = `addon:new:${serviceId ?? 'shared'}`
    return (
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">{heading}</h3>
        {addons.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('admin:catalogue.noAddons')}</p>
        ) : (
          <ul>{addons.map(addonRow)}</ul>
        )}
        {editing === newKey ? (
          <EntityForm
            title={t('admin:catalogue.newAddon')}
            submitLabel={t('admin:catalogue.create')}
            fields={ADDON_FIELDS}
            values={addonFormValues()}
            schema={addonFormSchema}
            onSave={(payload) => saved(catalogueApi.createAddon({ ...payload, serviceId }))}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <Button size="sm" variant="outline" className="self-start" onClick={() => setEditing(newKey)}>
            {t('admin:catalogue.addAddon')}
          </Button>
        )}
      </section>
    )
  }

  function serviceCard(service: CatalogueService) {
    const key = `service:${service.id}`
    const newPackageKey = `package:new:${service.id}`

    return (
      <Card key={service.id}>
        <CardHeader>
          {editing === key ? (
            <EntityForm
              title={t('admin:catalogue.editService')}
              submitLabel={t('admin:catalogue.save')}
              fields={SERVICE_FIELDS}
              values={serviceFormValues(service)}
              schema={serviceFormSchema}
              onSave={(payload) => saved(catalogueApi.updateService(service.id, payload))}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex flex-col gap-1">
                <CardTitle>
                  <h2 className="flex flex-wrap items-center gap-2">
                    {service.nameEn} {statusBadge(service.isActive)}
                  </h2>
                </CardTitle>
                <p className="text-muted-foreground text-sm">
                  /{service.slug} ·{' '}
                  {service.bookingFeeRateOverride === null
                    ? t('admin:catalogue.feeDefault')
                    : t('admin:catalogue.feeOverride', { percent: Number((service.bookingFeeRateOverride * 100).toFixed(1)) })}{' '}
                  · {t('admin:catalogue.order', { order: service.sortOrder })}
                </p>
              </div>
              {rowActions(
                service.nameEn,
                service.isActive,
                key,
                () => catalogueApi.updateService(service.id, { isActive: !service.isActive }),
                () => catalogueApi.deleteService(service.id),
              )}
            </div>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">{t('admin:catalogue.packages')}</h3>
            {service.packages.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t('admin:catalogue.noPackages')}</p>
            ) : (
              <ul>{service.packages.map(packageRow)}</ul>
            )}
            {editing === newPackageKey ? (
              <EntityForm
                title={t('admin:catalogue.newPackage')}
                submitLabel={t('admin:catalogue.create')}
                fields={PACKAGE_FIELDS}
                values={packageFormValues()}
                schema={packageFormSchema}
                onSave={(payload) =>
                  saved(catalogueApi.createPackage({ ...payload, serviceId: service.id }).then(rememberWarning))
                }
                onCancel={() => setEditing(null)}
              />
            ) : (
              <Button size="sm" variant="outline" className="self-start" onClick={() => setEditing(newPackageKey)}>
                {t('admin:catalogue.addPackage')}
              </Button>
            )}
          </section>
          {addonSection(service.id, service.addons, t('admin:catalogue.addons'))}
        </CardContent>
      </Card>
    )
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col">
          <h1 className="text-2xl font-semibold">{t('admin:catalogue.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('admin:catalogue.intro')}</p>
        </div>
        {editing !== 'service:new' && <Button onClick={() => setEditing('service:new')}>{t('admin:catalogue.addService')}</Button>}
      </div>

      {actionError !== null && (
        <p className="text-destructive text-sm" role="alert">
          {actionError}
        </p>
      )}

      {editing === 'service:new' && (
        <EntityForm
          title={t('admin:catalogue.newService')}
          submitLabel={t('admin:catalogue.create')}
          fields={SERVICE_FIELDS}
          values={serviceFormValues()}
          schema={serviceFormSchema}
          onSave={(payload) => saved(catalogueApi.createService(payload))}
          onCancel={() => setEditing(null)}
        />
      )}

      {loaded === null && (
        <p className="text-muted-foreground text-sm" role="status">
          {t('admin:catalogue.loading')}
        </p>
      )}
      {loaded !== null && loaded.data === null && (
        <div className="flex items-center gap-2" role="alert">
          <p className="text-destructive text-sm">{t('admin:catalogue.loadFailed')}</p>
          <Button variant="outline" size="sm" onClick={reload}>
            {t('admin:catalogue.retry')}
          </Button>
        </div>
      )}
      {loaded?.data != null && (
        <>
          {loaded.data.services.length === 0 && <p className="text-muted-foreground text-sm">{t('admin:catalogue.empty')}</p>}
          {loaded.data.services.map(serviceCard)}
          <Card>
            <CardContent className="flex flex-col gap-1">
              <p className="text-muted-foreground text-xs">{t('admin:catalogue.sharedAddonsHint')}</p>
              {addonSection(null, loaded.data.sharedAddons, t('admin:catalogue.sharedAddons'))}
            </CardContent>
          </Card>
        </>
      )}
    </main>
  )
}
