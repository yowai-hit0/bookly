import type { PrismaClient } from '@prisma/client';
import { type PaymentMethod, type PaymentProvider, PaymentProviderError } from './provider.js';

/**
 * Starting a booking-fee payment (plan.md Task 16; spec §3.1 step 9,
 * data-model_v2.md §5.11, §7.2).
 *
 * The payment row is written and committed -- `initiated`, with its `our_ref`
 * -- before the provider hears a word, so an attempt that never reaches the
 * provider, or dies halfway, is still on record. Its `amount_rwf` is the
 * booking's frozen `booking_fee_rwf` and is never written again.
 *
 * Then the provider is called, outside any transaction: a slow provider must not
 * hold a row lock or a pooled connection. Accepted, the row is `pending` and
 * waits for the webhook (Task 17). Refused, unreachable or too slow, it is
 * `failed` with the reason, and the booking is untouched: still
 * `pending_payment`, its hold still running, free to try again.
 */

/**
 * How long a waiting attempt blocks a new one. A second prompt while the first
 * is still on the payer's phone is how a deposit gets paid twice. Past this,
 * the payer has plainly moved on (a mistyped number, a dismissed prompt), and a
 * payment that settles late anyway is caught as a duplicate and flagged for
 * refund by the webhook. A developer default, not a spec value.
 */
export const PAYMENT_ATTEMPT_WINDOW_SECONDS = 180;
/** Past this the provider call is abandoned and the attempt recorded as failed. */
export const PROVIDER_CALL_TIMEOUT_MS = 30_000;
const FAILURE_REASON_MAX_LENGTH = 500;

export type StartPaymentDeps = {
  prisma: PrismaClient;
  provider: PaymentProvider;
  timeoutMs?: number;
};

export type StartPaymentRequest = {
  reference: string;
  method: PaymentMethod;
  /** Normalised by `normalizePhone`. */
  payerPhone: string;
};

export type StartPaymentResult =
  | { status: 'started'; ourRef: string }
  | { status: 'not_found' }
  /** A booking fee already succeeded: the 409 of plan.md Task 16. */
  | { status: 'already_paid' }
  /** The hold lapsed, or the booking is no longer waiting for payment. */
  | { status: 'hold_expired' }
  /** A zero booking fee has nothing to collect, and a payment row cannot be zero. */
  | { status: 'nothing_to_pay' }
  /** An earlier attempt is still waiting on the payer. */
  | { status: 'in_progress'; ourRef: string }
  | { status: 'provider_failed'; ourRef: string; outcome: 'rejected' | 'unavailable' };

type OpenedAttempt =
  | { status: 'opened'; paymentId: string; ourRef: string; amountRwf: number }
  | Exclude<StartPaymentResult, { status: 'started' } | { status: 'provider_failed' }>;

export async function startBookingFeePayment(deps: StartPaymentDeps, request: StartPaymentRequest): Promise<StartPaymentResult> {
  const { prisma, provider } = deps;

  const opened = await prisma.$transaction(async (tx): Promise<OpenedAttempt> => {
    // Locked, so two taps on "Pay" serialise here and the second sees the first.
    const bookings = await tx.$queryRaw<{ id: string; status: string; booking_fee_rwf: number; hold_live: boolean }[]>`
      SELECT id::text AS id, status, booking_fee_rwf,
             (hold_expires_at IS NOT NULL AND hold_expires_at > now()) AS hold_live
        FROM booking
       WHERE reference = ${request.reference}
         FOR UPDATE`;
    const booking = bookings[0];
    if (booking === undefined) return { status: 'not_found' };

    const paid = await tx.payment.count({ where: { bookingId: booking.id, kind: 'booking_fee', status: 'succeeded' } });
    if (paid > 0) return { status: 'already_paid' };
    // Measured on the database clock, like the hold itself (booking/claim.ts).
    if (booking.status !== 'pending_payment' || !booking.hold_live) return { status: 'hold_expired' };
    if (booking.booking_fee_rwf <= 0) return { status: 'nothing_to_pay' };

    const waiting = await tx.$queryRaw<{ our_ref: string }[]>`
      SELECT our_ref::text AS our_ref
        FROM payment
       WHERE booking_id = ${booking.id}::uuid
         AND kind = 'booking_fee'
         AND status IN ('initiated', 'pending')
         AND initiated_at > now() - make_interval(secs => ${PAYMENT_ATTEMPT_WINDOW_SECONDS}::double precision)
       ORDER BY initiated_at DESC
       LIMIT 1`;
    if (waiting[0] !== undefined) return { status: 'in_progress', ourRef: waiting[0].our_ref };

    // Every value the database can supply, it does: `our_ref`, `status`, `initiated_at`.
    const inserted = await tx.$queryRaw<{ id: string; our_ref: string; amount_rwf: number }[]>`
      INSERT INTO payment (booking_id, kind, provider, amount_rwf)
      VALUES (${booking.id}::uuid, 'booking_fee', ${provider.id}, ${booking.booking_fee_rwf})
      RETURNING id::text AS id, our_ref::text AS our_ref, amount_rwf`;
    const payment = inserted[0];
    if (payment === undefined) throw new Error('The payment insert returned no row');
    return { status: 'opened', paymentId: payment.id, ourRef: payment.our_ref, amountRwf: payment.amount_rwf };
  });

  if (opened.status !== 'opened') return opened;

  let failure: { outcome: 'rejected' | 'unavailable'; reason: string } | null = null;
  try {
    const result = await withDeadline(
      (signal) =>
        provider.initiate(
          {
            ourRef: opened.ourRef,
            amountRwf: opened.amountRwf,
            method: request.method,
            payerPhone: request.payerPhone,
            kind: 'booking_fee',
            bookingReference: request.reference,
          },
          signal,
        ),
      deps.timeoutMs ?? PROVIDER_CALL_TIMEOUT_MS,
    );
    if (result.outcome === 'accepted') {
      // Guarded: a webhook quick enough to have settled the row already wins.
      await prisma.payment.updateMany({
        where: { id: opened.paymentId, status: 'initiated' },
        data: { status: 'pending', ...(result.providerRef === null ? {} : { providerRef: result.providerRef }) },
      });
      return { status: 'started', ourRef: opened.ourRef };
    }
    failure = { outcome: 'rejected', reason: result.reason };
  } catch (error) {
    failure = { outcome: 'unavailable', reason: unavailableReason(error) };
  }

  await prisma.payment.updateMany({
    where: { id: opened.paymentId, status: 'initiated' },
    data: { status: 'failed', failureReason: storable(failure.reason) },
  });
  return { status: 'provider_failed', ourRef: opened.ourRef, outcome: failure.outcome };
}

/** Our own provider errors say what happened; anything else is named, never quoted. */
function unavailableReason(error: unknown): string {
  if (error instanceof PaymentProviderError) return `provider_unavailable: ${error.message}`;
  if (error instanceof ProviderTimeoutError) return 'provider_timeout';
  return `provider_unavailable: ${error instanceof Error ? error.name : 'error'}`;
}

class ProviderTimeoutError extends Error {
  override readonly name = 'ProviderTimeoutError';
}

/** Runs `call` with an abort signal, and gives up at the deadline even if it ignores the signal. */
async function withDeadline<T>(call: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new ProviderTimeoutError(`No answer within ${timeoutMs} ms`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([call(controller.signal), deadline]);
  } catch (error) {
    // The provider noticed the abort first: still a timeout.
    if (controller.signal.aborted) throw new ProviderTimeoutError(`No answer within ${timeoutMs} ms`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

const NUL = String.fromCharCode(0);
const REPLACEMENT = String.fromCharCode(0xfffd);

function storable(reason: string): string {
  return reason.split(NUL).join(REPLACEMENT).slice(0, FAILURE_REASON_MAX_LENGTH);
}
