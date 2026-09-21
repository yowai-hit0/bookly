import { CalendarCheck, Info, Link2, Tag } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { type PublicService, fetchServices } from '@/catalogue/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ServiceCard } from '@/pages/services/ServiceList'

/**
 * The public entry point (`design-system/bookly/pages/home.md`). Until
 * 2026-09-21 this was an API health stub with no link to anything; the page
 * clients actually used was `/services`.
 *
 * Nothing here is invented. There is no photographer name, logo, portfolio,
 * testimonial or review to show, so none appears. The service names and prices
 * in the preview are the API's, fetched with the same call `/services` makes,
 * and every claim in "What you can count on" is a rule the code enforces --
 * including the unfavourable one, that the booking fee is not refunded.
 */

/** How many services the preview shows before sending people to the full list. */
const PREVIEW_COUNT = 3

export function Home() {
  const { t } = useTranslation()
  const [preview, setPreview] = useState<PublicService[]>([])

  useEffect(() => {
    const controller = new AbortController()
    fetchServices(controller.signal)
      .then((services) => !controller.signal.aborted && setPreview(services.slice(0, PREVIEW_COUNT)))
      // Deliberately quiet: this is a marketing section, not the funnel. A
      // failure here renders nothing, and `/services` shows the real error
      // with the real retry.
      .catch(() => undefined)
    return () => controller.abort()
  }, [])

  // The preview is the first of the three white sections when it has anything
  // to show; when it does not, the steps take its border.
  const hasPreview = preview.length > 0

  return (
    <main className="flex flex-col text-pretty">
      <section className="px-4 py-12 sm:py-20">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-5">
          <h1 className="max-w-3xl text-4xl font-semibold text-balance sm:text-5xl">{t('landing:hero.title')}</h1>
          <p className="text-muted-foreground max-w-xl text-lg">{t('landing:hero.body')}</p>
          <Button asChild size="lg">
            <Link to="/services">{t('landing:hero.cta')}</Link>
          </Button>
          <p className="text-muted-foreground text-sm">{t('landing:hero.aside')}</p>
        </div>
      </section>

      {hasPreview && (
        <section className="bg-card border-t px-4 py-12 sm:py-16">
          <div className="mx-auto flex max-w-6xl flex-col gap-6">
            <h2 className="text-2xl font-semibold sm:text-3xl">{t('landing:preview.title')}</h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              {preview.map((service, index) => (
                <li key={service.id}>
                  <ServiceCard service={service} priority={index === 0} />
                </li>
              ))}
            </ul>
            <Link to="/services" className="inline-flex min-h-6 items-center rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:min-h-11 self-start text-sm font-medium">
              {t('landing:preview.more')}
            </Link>
          </div>
        </section>
      )}

      {/* One white block holds the preview, the steps and the facts: the page
          changes surface twice, at the hero and at the closing band. */}
      <section className={cn('bg-card px-4 py-12 sm:py-16', !hasPreview && 'border-t')}>
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          <h2 className="text-2xl font-semibold sm:text-3xl">{t('landing:how.title')}</h2>
          <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {([1, 2, 3, 4] as const).map((step) => (
              <li key={step} className="flex flex-col gap-2">
                {/* The list already carries the order for a screen reader. */}
                <span
                  aria-hidden="true"
                  className="bg-primary/10 text-primary font-heading flex size-9 items-center justify-center rounded-full text-sm font-semibold"
                >
                  {step}
                </span>
                <h3 className="text-base font-semibold">{t(`landing:how.step${step}.title`)}</h3>
                <p className="text-muted-foreground text-sm">{t(`landing:how.step${step}.body`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-card border-b px-4 py-12 sm:py-16">
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          <h2 className="text-2xl font-semibold sm:text-3xl">{t('landing:trust.title')}</h2>
          <ul className="grid gap-6 sm:grid-cols-2">
            <Fact icon={<Tag />} name="price" />
            <Fact icon={<CalendarCheck />} name="hold" />
            {/* The one unfavourable term, said here rather than only at checkout.
                Muted like the others, never destructive: it is a fact, not an error. */}
            <Fact icon={<Info />} name="fee" />
            <Fact icon={<Link2 />} name="link" />
          </ul>
        </div>
      </section>

      <section className="px-4 py-12 sm:py-16">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-4">
          <h2 className="text-2xl font-semibold text-balance sm:text-3xl">{t('landing:closing.title')}</h2>
          <Button asChild size="lg">
            <Link to="/services">{t('landing:closing.cta')}</Link>
          </Button>
        </div>
      </section>
    </main>
  )
}

/** One fact in "What you can count on": an icon paired with words, never alone. */
function Fact({ icon, name }: { icon: ReactNode; name: string }) {
  const { t } = useTranslation()
  return (
    <li className="flex gap-3">
      <span aria-hidden="true" className="text-primary mt-0.5 shrink-0 [&_svg]:size-5">
        {icon}
      </span>
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold">{t(`landing:trust.${name}.title`)}</h3>
        <p className="text-muted-foreground text-sm">{t(`landing:trust.${name}.body`)}</p>
      </div>
    </li>
  )
}
