import { adminFetch } from './api'

/**
 * The bookings list and everything the photographer does to a booking
 * (plan.md Task 19; spec §3.6, §6.11, §6.12, §6.16, §6.21).
 *
 * Every action answers with the booking as it now stands -- including the
 * refusals, which come back 409 carrying it -- so a screen acting on a stale
 * view is corrected by the same round trip that refused it. The `actions`
 * flags say what is possible; the API decides.
 */

export const BOOKING_STATUSES = [
  'pending_payment',
  'confirmed',
  'completed',
  'no_show',
  'expired',
  'cancelled_by_client',
  'cancelled_by_admin',
] as const

export type BookingStatus = (typeof BOOKING_STATUSES)[number]

export type BookingListRow = {
  id: string
  reference: string
  status: string
  startsAt: string
  endsAt: string
  contactName: string
  contactEmail: string
  contactPhone: string
  serviceName: string
  packageName: string
  grandTotalRwf: number
  collectedRwf: number
  outstandingRwf: number
  refundDueRwf: number
  hasRefundDue: boolean
}

export type BookingsPage = { bookings: BookingListRow[]; nextCursor: string | null }

export type BookingTotals = {
  quotedTotalRwf: number
  grandTotalRwf: number
  collectedRwf: number
  refundDueRwf: number
  outstandingRwf: number
}

export type AdminPayment = {
  id: string
  kind: string
  provider: string
  ourRef: string
  providerRef: string | null
  method: string | null
  amountRwf: number
  status: string
  failureReason: string | null
  initiatedAt: string
  settledAt: string | null
  refundedAt: string | null
  refundReference: string | null
  canRecordRefund: boolean
}

export type AdminBooking = {
  id: string
  reference: string
  status: string
  locale: string
  client: { id: string; fullName: string; email: string; phone: string | null; anonymized: boolean }
  contact: { name: string; email: string; phone: string }
  service: { id: string; name: string }
  package: { id: string; name: string; priceRwf: number; durationMinutes: number; photoCount: number }
  schedule: {
    startsAt: string
    endsAt: string
    bufferEndsAt: string
    holdExpiresAt: string | null
    originalStartsAt: string | null
    rescheduledAt: string | null
  }
  details: { locationText: string; partySize: number | null; specialRequests: string | null; consentAt: string }
  addons: { id: string; name: string; unitPriceRwf: number; quantity: number; amountRwf: number; stage: string }[]
  money: { bookingFeeRate: number; bookingFeeRwf: number; totals: BookingTotals }
  payments: AdminPayment[]
  lifecycle: { confirmedAt: string | null; completedAt: string | null; cancelledAt: string | null; cancellationReason: string | null }
  access: { hasLink: boolean; expiresAt: string | null; lastUsedAt: string | null }
  delivery: { url: string | null; expiresOn: string | null; sentAt: string | null; note: string | null }
  messages: {
    id: string
    kind: string
    template: string | null
    recipient: string | null
    status: string
    attempts: number
    lastError: string | null
    createdAt: string
    completedAt: string | null
  }[]
  actions: { canReschedule: boolean; canCancel: boolean; canComplete: boolean; canMarkNoShow: boolean; canResendLink: boolean }
}

export type BookingsFilter = {
  statuses?: readonly BookingStatus[]
  /** Kigali dates, inclusive. */
  from?: string
  to?: string
  search?: string
  cursor?: string
  limit?: number
}

export const bookingsApi = {
  list(filter: BookingsFilter = {}): Promise<BookingsPage> {
    const query = new URLSearchParams()
    for (const status of filter.statuses ?? []) query.append('status', status)
    for (const [key, value] of [
      ['from', filter.from],
      ['to', filter.to],
      ['search', filter.search],
      ['cursor', filter.cursor],
      ['limit', filter.limit?.toString()],
    ] as const) {
      if (value !== undefined && value !== '') query.set(key, value)
    }
    const suffix = query.toString()
    return adminFetch<BookingsPage>(`/admin/bookings${suffix === '' ? '' : `?${suffix}`}`)
  },

  get(id: string): Promise<{ booking: AdminBooking }> {
    return adminFetch<{ booking: AdminBooking }>(`/admin/bookings/${id}`)
  },

  reschedule(id: string, startsAt: string): Promise<{ booking: AdminBooking }> {
    return post(`/admin/bookings/${id}/reschedule`, { startsAt })
  },

  cancel(id: string, reason: string | null): Promise<{ booking: AdminBooking }> {
    return post(`/admin/bookings/${id}/cancel`, { reason })
  },

  complete(id: string): Promise<{ booking: AdminBooking }> {
    return post(`/admin/bookings/${id}/complete`, {})
  },

  markNoShow(id: string): Promise<{ booking: AdminBooking }> {
    return post(`/admin/bookings/${id}/no-show`, {})
  },

  resendLink(id: string): Promise<{ booking: AdminBooking }> {
    return post(`/admin/bookings/${id}/resend-link`, {})
  },

  /** Records a refund the photographer has already sent (spec §6.16). */
  recordRefund(paymentId: string, reference: string): Promise<{ booking: AdminBooking }> {
    return post(`/admin/payments/${paymentId}/refund`, { reference })
  },
}

function post(path: string, body: unknown): Promise<{ booking: AdminBooking }> {
  return adminFetch<{ booking: AdminBooking }>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
