import { env } from '@/env'
import { type PaymentMethod, type StartPaymentResult, PaymentApiError } from './payments'

/**
 * A client's own booking: `GET /api/booking/:token`, its cancellation and its
 * session-fee payment (plan.md Task 18; spec §3.9, §6.10).
 *
 * The token addresses everything. Nothing here sends a booking id, a reference
 * or an email, because the API would ignore them and because a page that never
 * holds them cannot leak them.
 */

export type ClientBookingPayment = {
  kind: 'booking_fee' | 'session_fee'
  status: string
  amountRwf: number
  settledAt: string | null
}

export type ClientBooking = {
  reference: string
  status: string
  clientName: string
  startsAt: string
  endsAt: string
  serviceName: string
  packageName: string
  packagePriceRwf: number
  packagePhotoCount: number
  packageDurationMinutes: number
  locationText: string
  partySize: number | null
  specialRequests: string | null
  addons: { name: string; priceRwf: number; stage: string }[]
  totals: {
    quotedTotalRwf: number
    grandTotalRwf: number
    collectedRwf: number
    refundDueRwf: number
    outstandingRwf: number
  }
  bookingFeeRwf: number
  payments: ClientBookingPayment[]
  canCancel: boolean
  cancellationReason: string | null
  cancelledAt: string | null
  sessionFee: { outstandingRwf: number; waitingPayment: { ourRef: string } | null } | null
  delivery: { url: string | null; expiresOn: string | null; expired: boolean; note: string | null } | null
}

/** Where a client's booking lives. The emails link here (`BOOKING_PAGE_PATH` on the API). */
export function bookingPath(token: string): string {
  return `/booking/${encodeURIComponent(token)}`
}

/** Where a session-fee payment is followed until it settles. */
export function bookingPaymentPath(token: string, ourRef: string): string {
  return `${bookingPath(token)}/payments/${encodeURIComponent(ourRef)}`
}

/** The booking, or null when the link is not valid -- unknown, expired or replaced. */
export async function fetchClientBooking(token: string, signal?: AbortSignal): Promise<ClientBooking | null> {
  const res = await get(`/booking/${encodeURIComponent(token)}`, signal)
  return bookingOf(res)
}

export type CancelBookingResult =
  | { status: 'cancelled'; booking: ClientBooking }
  /** Already cancelled, or past the shoot: the booking as it now stands. */
  | { status: 'not_cancellable'; booking: ClientBooking | null }
  | { status: 'not_found' }
  | { status: 'failed' }

export async function cancelBooking(token: string): Promise<CancelBookingResult> {
  let res: Response
  try {
    res = await fetch(`${env.VITE_API_BASE_URL}/booking/${encodeURIComponent(token)}/cancel`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
    })
  } catch {
    return { status: 'failed' }
  }
  if (res.status === 404) return { status: 'not_found' }
  try {
    const body = (await res.json()) as { booking?: unknown; error?: unknown }
    const booking = bookingOf(body)
    if (res.ok && booking !== null) return { status: 'cancelled', booking }
    if (res.status === 409) return { status: 'not_cancellable', booking }
  } catch {
    // Not the JSON this status promises.
  }
  return { status: 'failed' }
}

/** Starts a session-fee payment. The outcomes are the checkout's, minus the ones only it can meet. */
export async function startSessionFeePayment(
  token: string,
  request: { method: PaymentMethod; phone: string },
): Promise<StartPaymentResult> {
  let res: Response
  try {
    res = await fetch(`${env.VITE_API_BASE_URL}/booking/${encodeURIComponent(token)}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(request),
    })
  } catch {
    return { status: 'failed' }
  }

  try {
    const body = (await res.json()) as {
      error?: unknown
      reason?: unknown
      fields?: unknown
      payment?: { ourRef?: unknown } | null
    } | null
    const ourRef = typeof body?.payment?.ourRef === 'string' ? body.payment.ourRef : null
    if (res.status === 201 && ourRef !== null) return { status: 'started', ourRef }
    if (res.status === 404) return { status: 'not_found' }
    if (res.status === 409) {
      if (body?.error === 'payment_in_progress' && ourRef !== null) return { status: 'in_progress', ourRef }
      // Paid, cancelled or rescheduled under the page: reloading shows which.
      return { status: 'closed' }
    }
    if (res.status === 422 && Array.isArray(body?.fields)) return { status: 'invalid', fields: body.fields.map(String) }
    if (res.status === 502 && (body?.reason === 'rejected' || body?.reason === 'unavailable')) {
      return { status: 'not_started', reason: body.reason }
    }
  } catch {
    // Not the JSON this status promises.
  }
  return { status: 'failed' }
}

async function get(path: string, signal?: AbortSignal): Promise<unknown> {
  let res: Response
  try {
    // `no-store`: a booking's status and amounts change, and a cache must not answer for them.
    res = await fetch(`${env.VITE_API_BASE_URL}${path}`, { headers: { Accept: 'application/json' }, cache: 'no-store', signal })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new PaymentApiError(null)
  }
  if (res.status === 404) return null
  if (!res.ok) throw new PaymentApiError(res.status)
  try {
    return (await res.json()) as unknown
  } catch (error) {
    if (signal?.aborted) throw error
    throw new PaymentApiError(res.status)
  }
}

/** The booking in an answer, or null when the answer does not describe one. */
function bookingOf(body: unknown): ClientBooking | null {
  const booking = (body as { booking?: Partial<ClientBooking> | null } | null)?.booking
  if (typeof booking?.reference !== 'string' || typeof booking.status !== 'string' || typeof booking.totals !== 'object') {
    return null
  }
  return booking as ClientBooking
}
