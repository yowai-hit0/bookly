import { TriangleAlert } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { ApiError, UnauthenticatedError } from '@/admin/api'
import {
  type BlockFormValues,
  type BlockPayload,
  type OverlappingBooking,
  blockFormSchema,
  overlappingBookingsOf,
} from '@/admin/availability'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatDateTime, formatTime } from '@/lib/format'
import { AdminField } from './AdminField'

/**
 * Creating or editing one block (plan.md Task 8, spec §3.3 step 3, §6.4). The
 * availability page and the calendar both open this, so a block is described
 * one way wherever it is made.
 *
 * Whole days and part of a day are one form with two shapes rather than two
 * forms, because the choice is a property of the block, not a different task.
 *
 * Spec §6.4: a block never silently cancels a paid booking. When the API
 * answers 409 it names the confirmed bookings the block would cover, and this
 * shows them and asks. Saying yes resends the same payload with `confirm`, and
 * those bookings stay booked and become calendar conflicts.
 */

type Props = {
  title: string
  submitLabel: string
  values: BlockFormValues
  /** Throws `ApiError` when the API refuses the save. */
  onSave: (payload: BlockPayload) => Promise<void>
  onCancel: () => void
}

/** The API names the stored instant; the form names the date and time he types. */
const FORM_FIELD_FOR: Record<string, string> = { startsAt: 'startTime', endsAt: 'endTime' }

export function BlockForm({ title, submitLabel, values, onSave, onCancel }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [mode, setMode] = useState(values.mode)
  const [invalid, setInvalid] = useState<ReadonlySet<string>>(new Set())
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  /** The 409's bookings and the payload that caused it, held for "Block anyway". */
  const [overlap, setOverlap] = useState<{ bookings: OverlappingBooking[]; payload: BlockPayload } | null>(null)

  async function save(payload: BlockPayload) {
    setSaving(true)
    try {
      await onSave(payload)
    } catch (error) {
      if (error instanceof UnauthenticatedError) {
        navigate('/admin/login', { replace: true })
        return
      }
      const bookings = overlappingBookingsOf(error)
      if (bookings !== null) {
        setOverlap({ bookings, payload })
        return
      }
      const named = error instanceof ApiError ? error.fields.map((field) => FORM_FIELD_FOR[field] ?? field) : []
      if (named.length > 0) setInvalid(new Set(named))
      else setFormError(t('admin:availability.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const read = (name: string) => String(data.get(name) ?? '')

    setFormError(null)
    setOverlap(null)
    const parsed = blockFormSchema.safeParse({
      mode,
      startDate: read('startDate'),
      endDate: read('endDate'),
      date: read('date'),
      startTime: read('startTime'),
      endTime: read('endTime'),
      reason: read('reason'),
    })
    if (!parsed.success) {
      setInvalid(new Set(parsed.error.issues.map((issue) => String(issue.path[0]))))
      return
    }
    setInvalid(new Set())
    void save(parsed.data)
  }

  const errorFor = (field: string) => (invalid.has(field) ? t(`admin:availability.invalid.${field}`) : null)

  return (
    <form
      className="bg-muted/40 flex flex-col gap-3 rounded-lg border p-3"
      aria-label={title}
      noValidate
      onSubmit={onSubmit}
    >
      <h3 className="font-heading text-sm font-medium">{title}</h3>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="font-heading text-sm font-medium">{t('admin:availability.fields.mode')}</legend>
        <div className="flex flex-wrap gap-4">
          {(['all-day', 'time-range'] as const).map((option) => (
            <Label key={option} className="min-h-6 items-center gap-2 font-normal pointer-coarse:min-h-11">
              <input
                type="radio"
                name="mode"
                value={option}
                checked={mode === option}
                onChange={() => setMode(option)}
                className="accent-primary size-4"
              />
              {t(option === 'all-day' ? 'admin:availability.fields.modeAllDay' : 'admin:availability.fields.modeTimeRange')}
            </Label>
          ))}
        </div>
      </fieldset>

      {mode === 'all-day' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <AdminField label={t('admin:availability.fields.startDate')} error={errorFor('startDate')}>
            {(props) => <Input {...props} name="startDate" type="date" defaultValue={values.startDate} />}
          </AdminField>
          <AdminField
            label={t('admin:availability.fields.endDate')}
            hint={t('admin:availability.hints.endDate')}
            error={errorFor('endDate')}
          >
            {(props) => <Input {...props} name="endDate" type="date" defaultValue={values.endDate} />}
          </AdminField>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <AdminField label={t('admin:availability.fields.date')} error={errorFor('date')}>
            {(props) => <Input {...props} name="date" type="date" defaultValue={values.date} />}
          </AdminField>
          <AdminField label={t('admin:availability.fields.startTime')} error={errorFor('startTime')}>
            {(props) => <Input {...props} name="startTime" type="time" defaultValue={values.startTime} />}
          </AdminField>
          <AdminField label={t('admin:availability.fields.endTime')} error={errorFor('endTime')}>
            {(props) => <Input {...props} name="endTime" type="time" defaultValue={values.endTime} />}
          </AdminField>
        </div>
      )}

      <AdminField
        label={t('admin:availability.fields.reason')}
        hint={t('admin:availability.hints.reason')}
        error={errorFor('reason')}
      >
        {(props) => <Textarea {...props} name="reason" defaultValue={values.reason} />}
      </AdminField>

      {overlap !== null && (
        <div className="border-destructive bg-destructive/5 flex flex-col gap-2 rounded-lg border p-3" role="alert">
          <p className="flex items-center gap-2 text-sm font-medium">
            <TriangleAlert aria-hidden="true" className="text-destructive size-4 shrink-0" />
            {t('admin:availability.blocks.overlapTitle', { count: overlap.bookings.length })}
          </p>
          <ul className="flex flex-col gap-1 text-sm">
            {overlap.bookings.map((booking) => (
              <li key={booking.id}>
                {booking.reference} · {booking.contactName} · {formatDateTime(booking.startsAt)} to{' '}
                {formatTime(booking.endsAt)}
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground text-sm">{t('admin:availability.blocks.overlapBody')}</p>
          <div className="flex flex-wrap gap-2">
            {/* Irreversible, so it is a solid red button rather than the tinted
                variant (MASTER section 6); the override is here, not a new variant. */}
            <Button
              type="button"
              variant="destructive"
              className="bg-destructive text-white hover:bg-[color-mix(in_oklch,var(--destructive),black_12%)] focus-visible:border-ring focus-visible:ring-ring/50"
              disabled={saving}
              onClick={() => void save({ ...overlap.payload, confirm: true })}
            >
              {saving ? t('admin:availability.blocks.overlapSaving') : t('admin:availability.blocks.overlapConfirm')}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOverlap(null)}>
              {t('admin:availability.blocks.overlapCancel')}
            </Button>
          </div>
        </div>
      )}

      {formError !== null && (
        <p className="text-destructive text-sm" role="alert">
          {formError}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? t('admin:availability.saving') : submitLabel}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t('admin:availability.cancel')}
        </Button>
      </div>
    </form>
  )
}
