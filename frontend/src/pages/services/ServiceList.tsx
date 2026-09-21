import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { type PublicService, fetchServices } from '@/catalogue/api'
import { Button } from '@/components/ui/button'
import { formatMoney } from '@/lib/format'

/**
 * The public service list (plan.md Task 11, spec §3.1 step 1). What is listed
 * is what the API lists -- active services only; nothing is filtered or hidden
 * here (spec §2.2: no permission is enforced by hiding UI alone).
 */

type Loaded = { status: 'ok'; services: PublicService[] } | { status: 'failed' }

export function ServiceList() {
  const { t } = useTranslation()
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState<Loaded | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetchServices(controller.signal)
      .then((services) => !controller.signal.aborted && setLoaded({ status: 'ok', services }))
      .catch(() => !controller.signal.aborted && setLoaded({ status: 'failed' }))
    return () => controller.abort()
  }, [attempt])

  function retry() {
    setLoaded(null)
    setAttempt((n) => n + 1)
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold">{t('services:title')}</h1>
        <p className="text-muted-foreground">{t('services:intro')}</p>
      </header>

      {loaded === null && (
        <p className="text-muted-foreground text-sm" role="status">
          {t('services:loading')}
        </p>
      )}

      {loaded?.status === 'failed' && (
        <div className="flex flex-wrap items-center gap-2" role="alert">
          <p className="text-destructive text-sm">{t('services:loadFailed')}</p>
          <Button variant="outline" size="sm" onClick={retry}>
            {t('services:retry')}
          </Button>
        </div>
      )}

      {loaded?.status === 'ok' &&
        (loaded.services.length === 0 ? (
          <p className="text-muted-foreground">{t('services:empty')}</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {loaded.services.map((service, index) => (
              <li key={service.id}>
                <ServiceCard service={service} priority={index === 0} />
              </li>
            ))}
          </ul>
        ))}
    </main>
  )
}

/** Exported so the landing page's preview shows the same card, not a copy of it. */
export function ServiceCard({ service, priority }: { service: PublicService; priority: boolean }) {
  const { t } = useTranslation()
  const lowestPrice = service.packages.length === 0 ? null : Math.min(...service.packages.map((pkg) => pkg.priceRwf))

  return (
    // The heading's link is stretched over the whole card, so the card is one
    // tab stop with the service's name as its accessible name.
    // The only clickable card in the app, so it alone lifts on hover (a shadow,
    // never a move); its focus edge turns full-strength like a control's.
    <article className="bg-card relative flex h-full flex-col overflow-hidden rounded-xl border shadow-sm has-[a:focus-visible]:border-ring has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-ring/50 has-[a:hover]:shadow-md motion-safe:transition-shadow motion-safe:duration-200">
      {service.coverImageUrl !== null && (
        <img
          src={service.coverImageUrl}
          alt=""
          className="bg-muted aspect-3/2 w-full object-cover"
          fetchPriority={priority ? 'high' : 'auto'}
          loading={priority ? 'eager' : 'lazy'}
        />
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h2 className="text-lg font-semibold text-balance">
          <Link to={`/services/${service.slug}`} className="underline-offset-4 after:absolute after:inset-0 hover:underline focus-visible:outline-none">
            {service.nameEn}
          </Link>
        </h2>
        {service.descriptionEn !== null && (
          <p className="text-muted-foreground line-clamp-3 text-sm">{service.descriptionEn}</p>
        )}
        {lowestPrice !== null && (
          <p className="mt-auto pt-2 text-sm font-medium tabular-nums">{t('services:fromPrice', { price: formatMoney(lowestPrice) })}</p>
        )}
      </div>
    </article>
  )
}
