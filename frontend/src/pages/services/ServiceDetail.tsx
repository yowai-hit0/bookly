import type { TFunction } from 'i18next'
import { type FormEvent, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { type PublicServiceDetail, fetchService } from '@/catalogue/api'
import {
  DETAIL_FIELDS,
  type DetailField,
  type HeldBooking,
  parseBookingDetails,
  submitBooking,
} from '@/catalogue/bookings'
import { BackLink } from '@/components/ui/back-link'
import { Button } from '@/components/ui/button'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import { NotFound } from '@/pages/NotFound'
import { BookingDetailsForm } from './BookingDetailsForm'
import { BookingHeld } from './BookingHeld'
import { PriceSummary } from './PriceSummary'
import { SlotPicker, type SlotPickerHandle } from './SlotPicker'
import { stepNumber } from './step-number'

/**
 * One service's packages and add-ons, with a total that updates as they are
 * chosen (plan.md Task 11, spec §3.1 steps 2, 3 and 7).
 *
 * An unknown or deactivated slug is the not-found page: the API answers 404
 * for both, so a retired service does not exist to the public (spec §6.14).
 * Nothing is preselected -- the visitor picks the package they are buying.
 * Once a package is chosen, the slot picker offers its bookable starts
 * (plan.md Task 12), and the booking form below it creates the booking once a
 * start is chosen (Task 13); the page then becomes the held booking's summary.
 */

type Loaded =
  | { slug: string; status: 'ok'; service: PublicServiceDetail }
  | { slug: string; status: 'missing' }
  | { slug: string; status: 'failed' }

export function ServiceDetail() {
  const { t } = useTranslation()
  const { slug = '' } = useParams()
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState<Loaded | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetchService(slug, controller.signal)
      .then((service) => {
        if (controller.signal.aborted) return
        setLoaded(service === null ? { slug, status: 'missing' } : { slug, status: 'ok', service })
      })
      .catch(() => !controller.signal.aborted && setLoaded({ slug, status: 'failed' }))
    return () => controller.abort()
  }, [slug, attempt])

  function retry() {
    setLoaded(null)
    setAttempt((n) => n + 1)
  }

  // A load for another slug is stale: moving between services shows loading,
  // not the previous service.
  const current = loaded?.slug === slug ? loaded : null

  if (current?.status === 'missing') return <NotFound />
  if (current?.status === 'ok') return <ServiceView key={current.service.id} service={current.service} />

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <AllServicesLink />
      {current === null ? (
        <p className="text-muted-foreground text-sm" role="status">
          {t('services:loading')}
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2" role="alert">
          <p className="text-destructive text-sm">{t('services:loadServiceFailed')}</p>
          <Button variant="outline" size="sm" onClick={retry}>
            {t('services:retry')}
          </Button>
        </div>
      )}
    </main>
  )
}

function ServiceView({ service }: { service: PublicServiceDetail }) {
  const { t } = useTranslation()
  const [packageId, setPackageId] = useState<string | null>(null)
  const [addonIds, setAddonIds] = useState<ReadonlySet<string>>(new Set())
  /** The chosen start, an ISO instant, confirmed free by the API when chosen. */
  const [startsAt, setStartsAt] = useState<string | null>(null)
  const formId = useId()
  const picker = useRef<SlotPickerHandle>(null)
  const [invalid, setInvalid] = useState<ReadonlySet<DetailField>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<'failed' | 'catalogueChanged' | null>(null)
  /** The booking the API created; the page becomes its confirmation. */
  const [held, setHeld] = useState<HeldBooking | null>(null)

  const chosenPackage = service.packages.find((pkg) => pkg.id === packageId) ?? null
  // Catalogue order, whatever order they were ticked in.
  const chosenAddons = service.addons.filter((addon) => addonIds.has(addon.id))

  /**
   * Creates the booking (plan.md Task 13). The form's own check runs first as a
   * convenience; the API's answer is what counts. A start the API refuses --
   * taken in a race (409), or no longer offered (422 on `startsAt`) -- is the
   * picker's "just taken" state with a refreshed calendar, never a dead end
   * (spec §6.1). What the visitor typed stays in the form either way.
   */
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    if (submitting || chosenPackage === null || startsAt === null) return
    setSubmitError(null)

    const parsed = parseBookingDetails(new FormData(form))
    if (!parsed.ok) {
      markInvalid(form, parsed.fields)
      return
    }
    setInvalid(new Set())

    setSubmitting(true)
    const result = await submitBooking({
      packageId: chosenPackage.id,
      addonIds: chosenAddons.map((addon) => addon.id),
      startsAt,
      ...parsed.details,
    })
    setSubmitting(false)

    if (result.status === 'created') {
      setHeld(result.booking)
      return
    }
    if (result.status === 'failed') {
      setSubmitError('failed')
      return
    }

    const fields: readonly string[] = result.status === 'slot_taken' ? ['startsAt'] : result.fields
    const details = DETAIL_FIELDS.filter((field) => fields.includes(field))
    const catalogueChanged = fields.includes('packageId') || fields.includes('addonIds')
    if (catalogueChanged) setSubmitError('catalogueChanged')
    if (details.length > 0) markInvalid(form, details)
    if (fields.includes('startsAt')) picker.current?.reportTaken(startsAt)
    if (!catalogueChanged && details.length === 0 && !fields.includes('startsAt')) setSubmitError('failed')
  }

  function markInvalid(form: HTMLFormElement, fields: readonly DetailField[]) {
    setInvalid(new Set(fields))
    const first = fields[0] === undefined ? null : form.elements.namedItem(fields[0])
    if (first instanceof HTMLElement) first.focus()
  }

  function toggleAddon(id: string, checked: boolean) {
    setAddonIds((current) => {
      const next = new Set(current)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  if (held !== null) {
    return (
      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
        <BookingHeld booking={held} />
      </main>
    )
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <AllServicesLink />
      <header className="flex flex-col gap-3">
        {service.coverImageUrl !== null && (
          <img
            src={service.coverImageUrl}
            alt=""
            className="bg-muted aspect-21/9 w-full rounded-xl object-cover"
            fetchPriority="high"
          />
        )}
        <h1 className="text-3xl font-semibold">{service.nameEn}</h1>
        {service.descriptionEn !== null && (
          <p className="text-muted-foreground max-w-2xl whitespace-pre-line">{service.descriptionEn}</p>
        )}
      </header>

      {service.packages.length === 0 ? (
        <p className="text-muted-foreground">{t('services:noPackages')}</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
          {/* The counter numbers the three groups: choose, pick a time, your details (step-number.ts). */}
          <div className="flex flex-col gap-6 [counter-reset:step]">
            <fieldset className="flex flex-col gap-2">
              <legend className={cn('font-heading mb-2 text-lg font-semibold', stepNumber)}>{t('services:choosePackage')}</legend>
              {service.packages.map((pkg) => (
                <label
                  key={pkg.id}
                  className="bg-card has-checked:border-primary has-checked:bg-primary/5 has-checked:ring-primary not-has-checked:hover:bg-muted/60 has-focus-visible:border-ring has-focus-visible:ring-ring/50 flex cursor-pointer gap-3 rounded-xl border p-4 shadow-sm has-checked:ring-1 has-focus-visible:ring-3 motion-safe:transition-colors motion-safe:duration-150"
                >
                  <input
                    type="radio"
                    name="package"
                    value={pkg.id}
                    checked={packageId === pkg.id}
                    onChange={() => setPackageId(pkg.id)}
                    className="accent-primary mt-1 size-4 shrink-0"
                  />
                  <span className="flex flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-baseline justify-between gap-x-4">
                      <span className="font-medium">{pkg.nameEn}</span>
                      <span className="font-semibold tabular-nums">{formatMoney(pkg.priceRwf)}</span>
                    </span>
                    <span className="text-muted-foreground text-sm">
                      {t('services:photos', { count: pkg.photoCount })} · {formatDuration(t, pkg.durationMinutes)}
                    </span>
                    {pkg.descriptionEn !== null && (
                      <span className="text-muted-foreground text-sm whitespace-pre-line">{pkg.descriptionEn}</span>
                    )}
                  </span>
                </label>
              ))}
            </fieldset>

            {service.addons.length > 0 && (
              <fieldset className="flex flex-col gap-2">
                <legend className="font-heading mb-2 text-lg font-semibold">{t('services:chooseAddons')}</legend>
                {service.addons.map((addon) => (
                  <label
                    key={addon.id}
                    className="bg-card has-checked:border-primary has-checked:bg-primary/5 has-checked:ring-primary not-has-checked:hover:bg-muted/60 has-focus-visible:border-ring has-focus-visible:ring-ring/50 flex cursor-pointer items-center gap-3 rounded-xl border p-3 shadow-sm has-checked:ring-1 has-focus-visible:ring-3 motion-safe:transition-colors motion-safe:duration-150"
                  >
                    <input
                      type="checkbox"
                      checked={addonIds.has(addon.id)}
                      onChange={(event) => toggleAddon(addon.id, event.target.checked)}
                      className="accent-primary size-4 shrink-0"
                    />
                    <span className="flex-1">{addon.nameEn}</span>
                    <span className="tabular-nums">{formatMoney(addon.priceRwf)}</span>
                  </label>
                ))}
              </fieldset>
            )}

            {chosenPackage === null ? (
              <section className="flex flex-col gap-1">
                <h2 className={cn('text-lg font-semibold', stepNumber)}>{t('services:picker.title')}</h2>
                <p className="text-muted-foreground text-sm">{t('services:picker.choosePackageFirst')}</p>
              </section>
            ) : (
              <>
                <SlotPicker
                  ref={picker}
                  packageId={chosenPackage.id}
                  durationMinutes={chosenPackage.durationMinutes}
                  value={startsAt}
                  onChange={setStartsAt}
                />
                <BookingDetailsForm id={formId} invalid={invalid} onSubmit={(event) => void submit(event)} />
              </>
            )}
          </div>

          {/* Below lg it is the last thing on the page, the closing step, so it gets extra room above. */}
          <div className="max-lg:mt-4 lg:sticky lg:top-4">
            <PriceSummary pkg={chosenPackage} addons={chosenAddons} bookingFeeRate={service.bookingFeeRate}>
              {chosenPackage !== null &&
                (startsAt === null ? (
                  <p className="text-muted-foreground text-sm">{t('services:booking.chooseTimeFirst')}</p>
                ) : (
                  <Button
                    type="submit"
                    form={formId}
                    className="w-full"
                    // Not `disabled`: that would drop keyboard focus mid-submit.
                    // `submit` ignores a second press instead.
                    aria-disabled={submitting}
                    aria-busy={submitting}
                  >
                    {t(submitting ? 'services:booking.submitting' : 'services:booking.submit')}
                  </Button>
                ))}
              {/* Outside the start check: a refusal can clear the start and still need saying. */}
              {chosenPackage !== null && submitError !== null && (
                <p className="text-destructive text-sm" role="alert">
                  {t(`services:booking.${submitError}`)}
                </p>
              )}
            </PriceSummary>
          </div>
        </div>
      )}
    </main>
  )
}

function AllServicesLink() {
  const { t } = useTranslation()
  return <BackLink to="/services">{t('services:allServices')}</BackLink>
}

/** `90` → `1 h 30 min`; `120` → `2 hours`; `45` → `45 min`. */
function formatDuration(t: TFunction, minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return t('services:duration.minutes', { count: minutes })
  if (rest === 0) return t('services:duration.hours', { count: hours })
  return t('services:duration.hoursAndMinutes', { hours, minutes: rest })
}
