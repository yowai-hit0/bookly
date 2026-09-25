import { Ban, CalendarClock, Images, type LucideIcon, MessageSquare, Receipt, Wallet, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { kigaliDateOf } from '@/admin/calendar-dates'
import type { ClientNotice } from '@/catalogue/booking-access'
import { Button } from '@/components/ui/button'
import { formatDate, formatDateTime, formatMoney, formatTime } from '@/lib/format'
import { dismissNotice, isNoticeShown, markNoticesSeen, readSeen } from '@/lib/seen-notices'

/**
 * What has happened to a booking, at the top of its page
 * (docs/prompts/client-access-and-admin-polish.md, item 8): moved, a fee asked
 * for, a payment received, the photos sent, cancelled by the photographer,
 * money still owed, and the photographer's own notes -- newest first, as the
 * API lists them.
 *
 * Each can be closed, and each stops showing a day after this device first
 * showed it, except money still owed, which only closing hides
 * (`lib/seen-notices.ts`). With nothing left to show, nothing renders.
 */

const ICONS: Record<ClientNotice['kind'], LucideIcon> = {
  reschedule: CalendarClock,
  session_fee_request: Wallet,
  payment_receipt: Receipt,
  photo_delivery: Images,
  cancelled_by_photographer: Ban,
  balance_due: Wallet,
  note: MessageSquare,
}

export function Notices({ reference, notices }: { reference: string; notices: ClientNotice[] }) {
  const { t } = useTranslation()
  // Read once per render from storage, so a close takes effect at once.
  const [, setVersion] = useState(0)
  const [now] = useState(() => Date.now())
  const seen = readSeen(reference)
  const shown = notices.filter((notice) => isNoticeShown(notice, seen, now))
  const shownIds = shown.map((notice) => notice.id).join('|')

  useEffect(() => {
    if (shownIds !== '') markNoticesSeen(reference, shownIds.split('|'), now)
  }, [reference, shownIds, now])

  if (shown.length === 0) return null

  return (
    <section aria-label={t('booking:notices.label')} className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {shown.map((notice) => {
          const Icon = ICONS[notice.kind]
          return (
            <li key={notice.id} className="bg-card flex items-start gap-3 rounded-lg border p-3 text-sm shadow-sm">
              <Icon aria-hidden="true" className="text-ring mt-0.5 size-4 shrink-0" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="wrap-anywhere">
                  <NoticeText notice={notice} />
                </p>
                <p className="text-muted-foreground text-xs">{formatDateTime(notice.at)}</p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t('booking:notices.dismiss')}
                onClick={() => {
                  dismissNotice(reference, notice.id, Date.now())
                  setVersion((n) => n + 1)
                }}
              >
                <X aria-hidden="true" />
              </Button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function NoticeText({ notice }: { notice: ClientNotice }) {
  const { t } = useTranslation()
  switch (notice.kind) {
    case 'reschedule':
      return t('booking:notices.reschedule', {
        date: formatDate(kigaliDateOf(notice.data.startsAt)),
        start: formatTime(notice.data.startsAt),
        end: formatTime(notice.data.endsAt),
      })
    case 'session_fee_request':
      return t('booking:notices.sessionFeeRequest', { amount: formatMoney(notice.data.amountRwf) })
    case 'payment_receipt':
      return t('booking:notices.paymentReceipt', { amount: formatMoney(notice.data.amountRwf) })
    case 'photo_delivery':
      return t('booking:notices.photoDelivery')
    case 'cancelled_by_photographer':
      return t('booking:notices.cancelledByPhotographer')
    case 'balance_due':
      return (
        <>
          {t('booking:notices.balanceDue', { amount: formatMoney(notice.data.amountRwf) })}{' '}
          <a href="#pay" className="font-medium underline underline-offset-4">
            {t('booking:notices.payNow')}
          </a>
        </>
      )
    case 'note':
      return (
        <>
          <span className="font-medium">{t('booking:notices.fromPhotographer')}</span>{' '}
          {/* Plain text, as the photographer typed it: React escapes it, and line breaks stay. */}
          <span className="whitespace-pre-line">{notice.data.body}</span>
        </>
      )
  }
}
