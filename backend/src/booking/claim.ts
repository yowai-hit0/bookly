import type { Booking, Prisma, PrismaClient } from '@prisma/client';
import { isSlotTaken } from '../db/errors.js';

/**
 * The slot claim transaction (plan.md Task 6, data-model_v2.md §9.2).
 *
 * This is the concurrency-correct core of the double-booking fix. Correctness
 * does not live here -- it lives in `booking_no_overlap`, which makes two
 * overlapping reservations impossible whatever this code does. What lives here
 * is the one thing the constraint cannot do for itself: a predicate cannot call
 * `now()`, so a `pending_payment` row whose hold has lapsed still occupies its
 * range until something flips it to `expired`. A client claiming that slot in
 * the gap would be refused on behalf of a dead hold, so the claim expires stale
 * holds itself, inside the same transaction, before it inserts.
 *
 * The sweeper (`hold-sweeper.ts`) still runs for tidiness. Correctness does not
 * depend on its cadence.
 */

/** Everything the caller has already resolved: snapshots, references, amounts.
 *  Task 13 owns those rules; this module owns the race. */
export type ClaimSlotInput = Omit<
  Prisma.BookingUncheckedCreateInput,
  'id' | 'status' | 'holdExpiresAt' | 'createdAt' | 'updatedAt' | 'confirmedAt'
> & {
  startsAt: Date;
  endsAt: Date;
  bufferEndsAt: Date;
};

export type ClaimResult =
  | { status: 'claimed'; booking: Booking }
  /** Live occupancy already covers the range. The client sees "this slot was
   *  just taken" with a refreshed calendar (spec §6.1). */
  | { status: 'slot_taken' };

/**
 * Claims `[startsAt, bufferEndsAt)` for a new `pending_payment` booking.
 *
 * Returns a typed result rather than throwing: losing a race is an expected
 * outcome of a public booking form, not an exceptional one. Any other database
 * error still throws.
 */
export async function claimSlot(
  prisma: PrismaClient,
  input: ClaimSlotInput,
  holdMinutes: number,
): Promise<ClaimResult> {
  try {
    const booking = await prisma.$transaction(async (tx) => {
      // Both the hold's expiry and the staleness check below are measured
      // against the database clock, so no app/database skew can make a hold
      // outlive or predecease what the sweeper and the claim believe.
      const holdExpiresAt = await databaseNowPlusMinutes(tx, holdMinutes);

      await expireOverlappingStaleHolds(tx, input.startsAt, input.bufferEndsAt);

      // The constraint now sees only live occupancy.
      return tx.booking.create({
        data: { ...input, status: 'pending_payment', holdExpiresAt },
      });
    });

    return { status: 'claimed', booking };
  } catch (error) {
    // A failed statement aborts the whole transaction in PostgreSQL, so this is
    // caught outside the callback: the rollback has already happened by the time
    // we get here. Catching inside would leave us trying to COMMIT a dead
    // transaction.
    if (isSlotTaken(error)) return { status: 'slot_taken' };
    throw error;
  }
}

/**
 * Step 2 of §9.2. Scoped to holds that overlap the requested range: this clears
 * what is in the way, not the whole table. The sweeper handles the rest.
 */
export async function expireOverlappingStaleHolds(
  tx: Prisma.TransactionClient,
  startsAt: Date,
  bufferEndsAt: Date,
): Promise<number> {
  return tx.$executeRaw`
    UPDATE booking
       SET status = 'expired'
     WHERE status = 'pending_payment'
       AND hold_expires_at <= now()
       AND tstzrange(starts_at, buffer_ends_at, '[)')
           && tstzrange(${startsAt}::timestamptz, ${bufferEndsAt}::timestamptz, '[)')`;
}

/**
 * The database clock, as epoch milliseconds.
 *
 * Deliberately NOT `SELECT now()`. A `timestamptz` crossing the driver boundary
 * is only unambiguous while the session timezone is UTC, which `db/client.ts`
 * pins for exactly that reason. Epoch milliseconds have no timezone to get
 * wrong at all, so this stays correct even if that pin is ever lost -- and a
 * hold born already lapsed is the failure it prevents.
 *
 * Do not "simplify" this back to selecting a timestamp; a test pins the window.
 */
async function databaseNowPlusMinutes(
  tx: Prisma.TransactionClient,
  minutes: number,
): Promise<Date> {
  const rows = await tx.$queryRaw<{ ms: bigint }[]>`
    SELECT (extract(epoch from now()) * 1000)::bigint AS ms`;
  const row = rows[0];
  if (row === undefined) throw new Error('The database returned no clock reading.');
  return new Date(Number(row.ms) + minutes * 60_000);
}
