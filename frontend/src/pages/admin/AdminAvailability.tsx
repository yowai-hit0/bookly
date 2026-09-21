import { CircleSlash } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { UnauthenticatedError } from '@/admin/api'
import {
  type AdminBlock,
  type AdminWorkingHours,
  availabilityApi,
  blockFormValues,
  formatMinuteOfDay,
  kigaliWallTime,
  workingHoursFormValues,
} from '@/admin/availability'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate, formatTime } from '@/lib/format'
import { BlockForm } from './BlockForm'
import { WorkingHoursForm } from './WorkingHoursForm'

/**
 * Working hours and blocks on one page (plan.md Task 8, spec §3.3, §6.3,
 * §6.4). They are one screen because they answer one question between them --
 * when can a client book? -- and reading either alone gives the wrong answer.
 *
 * One form is open at a time. After any save both lists are fetched again (a
 * few dozen rows), so what is shown is always what is stored.
 */

type Data = { workingHours: AdminWorkingHours[]; blocks: AdminBlock[] }

/** Which form is open: `hours:new`, `hours:<id>`, `block:new`, `block:<id>`. */
type Editing = string | null

export function AdminAvailability() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [version, setVersion] = useState(0)
  /** The latest load; `data` is null when it failed. Kept across reloads, so a
   *  save does not blank the page while the fresh copy arrives. */
  const [loaded, setLoaded] = useState<{ data: Data | null } | null>(null)
  const [editing, setEditing] = useState<Editing>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([availabilityApi.loadWorkingHours(), availabilityApi.loadBlocks()])
      .then(([hours, blocks]) => {
        if (!cancelled) setLoaded({ data: { workingHours: hours.workingHours, blocks: blocks.blocks } })
      })
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

  /** A one-click action, today only delete. */
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
      setActionError(t('admin:availability.actionFailed'))
    }
  }

  function remove(question: string, action: () => Promise<unknown>) {
    if (window.confirm(question)) void act(action)
  }

  /** What a row is called in a button's accessible name and its delete question. */
  function nameOfHours(row: AdminWorkingHours): string {
    return row.weekday === null
      ? formatDate(row.effectiveDate ?? '')
      : t(`admin:availability.weekdays.${row.weekday}`)
  }

  function nameOfBlock(block: AdminBlock): string {
    return formatDate(kigaliWallTime(block.startsAt).date)
  }

  function describeBlock(block: AdminBlock): string {
    const from = kigaliWallTime(block.startsAt).date
    if (!block.isAllDay) {
      return t('admin:availability.blocks.timeRange', {
        date: formatDate(from),
        start: formatTime(block.startsAt),
        end: formatTime(block.endsAt),
      })
    }
    // An all-day block ends at the midnight after its last day, so the inclusive
    // last day is the day before that boundary.
    const to = kigaliWallTime(new Date(Date.parse(block.endsAt) - 1).toISOString()).date
    return from === to
      ? t('admin:availability.blocks.allDayOne', { date: formatDate(from) })
      : t('admin:availability.blocks.allDayRange', { from: formatDate(from), to: formatDate(to) })
  }

  function hoursRow(row: AdminWorkingHours) {
    const key = `hours:${row.id}`
    const name = nameOfHours(row)

    if (editing === key) {
      return (
        <li key={row.id}>
          <WorkingHoursForm
            title={t('admin:availability.hours.editTitle')}
            submitLabel={t('admin:availability.save')}
            values={workingHoursFormValues(row)}
            onSave={(payload) => saved(availabilityApi.updateWorkingHours(row.id, payload))}
            onCancel={() => setEditing(null)}
          />
        </li>
      )
    }

    const isClosed = !(row.isOpen && row.opensMinute !== null && row.closesMinute !== null)

    return (
      <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 last:border-b-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">
            {row.weekday === null ? name : t('admin:availability.hours.everyDay', { day: name })}
          </span>
          <Badge variant="outline">
            {t(row.weekday === null ? 'admin:availability.hours.datedBadge' : 'admin:availability.hours.weeklyBadge')}
          </Badge>
          {/* A closed day is a different state, not a lesser one: an icon marks
              it, never colour or opacity alone (`pages/availability.md`). */}
          {isClosed ? (
            <span className="text-muted-foreground inline-flex items-center gap-1 text-sm">
              <CircleSlash aria-hidden="true" className="size-4" />
              {t('admin:availability.hours.closed')}
            </span>
          ) : (
            <span className="text-muted-foreground text-sm">
              {t('admin:availability.hours.window', {
                opens: formatMinuteOfDay(row.opensMinute ?? 0),
                closes: formatMinuteOfDay(row.closesMinute ?? 0),
              })}
            </span>
          )}
          {row.note !== null && <span className="text-muted-foreground text-sm">· {row.note}</span>}
        </div>
        <div className="flex flex-wrap gap-1">
          <Button
            size="sm"
            variant="outline"
            aria-label={t('admin:availability.hours.editNamed', { name })}
            onClick={() => setEditing(key)}
          >
            {t('admin:availability.edit')}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            aria-label={t('admin:availability.hours.deleteNamed', { name })}
            onClick={() =>
              remove(
                t(
                  row.weekday === null
                    ? 'admin:availability.hours.confirmDeleteDated'
                    : 'admin:availability.hours.confirmDeleteWeekly',
                  { name },
                ),
                () => availabilityApi.deleteWorkingHours(row.id),
              )
            }
          >
            {t('admin:availability.delete')}
          </Button>
        </div>
      </li>
    )
  }

  function blockRow(block: AdminBlock) {
    const key = `block:${block.id}`
    const name = nameOfBlock(block)

    if (editing === key) {
      return (
        <li key={block.id}>
          <BlockForm
            title={t('admin:availability.blocks.editTitle')}
            submitLabel={t('admin:availability.save')}
            values={blockFormValues(block)}
            onSave={(payload) => saved(availabilityApi.updateBlock(block.id, payload))}
            onCancel={() => setEditing(null)}
          />
        </li>
      )
    }

    return (
      <li key={block.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 last:border-b-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{describeBlock(block)}</span>
          <span className="text-muted-foreground text-sm">
            {block.reason ?? t('admin:availability.blocks.noReason')}
          </span>
        </div>
        <div className="flex flex-wrap gap-1">
          <Button
            size="sm"
            variant="outline"
            aria-label={t('admin:availability.blocks.editNamed', { name })}
            onClick={() => setEditing(key)}
          >
            {t('admin:availability.edit')}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            aria-label={t('admin:availability.blocks.deleteNamed', { name })}
            onClick={() =>
              remove(t('admin:availability.blocks.confirmDelete', { name }), () =>
                availabilityApi.deleteBlock(block.id),
              )
            }
          >
            {t('admin:availability.delete')}
          </Button>
        </div>
      </li>
    )
  }

  const data = loaded?.data ?? null

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 p-4">
      <div className="flex flex-col">
        <h1 className="text-2xl font-semibold">{t('admin:availability.title')}</h1>
        <p className="text-muted-foreground text-sm">{t('admin:availability.intro')}</p>
      </div>

      {actionError !== null && (
        <p className="text-destructive text-sm" role="alert">
          {actionError}
        </p>
      )}

      {loaded === null && (
        <p className="text-muted-foreground text-sm" role="status">
          {t('admin:availability.loading')}
        </p>
      )}
      {loaded !== null && data === null && (
        <div className="flex items-center gap-2" role="alert">
          <p className="text-destructive text-sm">{t('admin:availability.loadFailed')}</p>
          <Button variant="outline" size="sm" onClick={reload}>
            {t('admin:availability.retry')}
          </Button>
        </div>
      )}

      {data !== null && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>{t('admin:availability.hours.title')}</h2>
              </CardTitle>
              <p className="text-muted-foreground text-sm">{t('admin:availability.hours.intro')}</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {data.workingHours.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t('admin:availability.hours.empty')}</p>
              ) : (
                <ul>{data.workingHours.map(hoursRow)}</ul>
              )}
              {editing === 'hours:new' ? (
                <WorkingHoursForm
                  title={t('admin:availability.hours.new')}
                  submitLabel={t('admin:availability.create')}
                  values={workingHoursFormValues()}
                  onSave={(payload) => saved(availabilityApi.createWorkingHours(payload))}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <Button size="sm" variant="outline" className="self-start" onClick={() => setEditing('hours:new')}>
                  {t('admin:availability.hours.add')}
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                <h2>{t('admin:availability.blocks.title')}</h2>
              </CardTitle>
              <p className="text-muted-foreground text-sm">{t('admin:availability.blocks.intro')}</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {data.blocks.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t('admin:availability.blocks.empty')}</p>
              ) : (
                <ul>{data.blocks.map(blockRow)}</ul>
              )}
              {editing === 'block:new' ? (
                <BlockForm
                  title={t('admin:availability.blocks.new')}
                  submitLabel={t('admin:availability.create')}
                  values={blockFormValues(undefined, kigaliWallTime(new Date().toISOString()).date)}
                  onSave={(payload) => saved(availabilityApi.createBlock(payload))}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <Button size="sm" variant="outline" className="self-start" onClick={() => setEditing('block:new')}>
                  {t('admin:availability.blocks.add')}
                </Button>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </main>
  )
}
