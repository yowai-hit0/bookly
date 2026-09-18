import type { Prisma, PrismaClient } from '@prisma/client';
import { type KigaliDate, kigaliMinuteToUtc } from '../availability/engine.js';
import type { BookingStatus } from '../db/statuses.js';
import { bookingTotals } from './totals.js';

/**
 * The bookings list (plan.md Task 19): filtered by status and date, paged by a
 * cursor rather than an offset.
 *
 * A cursor, because an offset is not stable. Page 2 of `OFFSET 20` shifts the
 * moment a booking is created or rescheduled, so a row can be shown twice or
 * skipped entirely. The cursor names the last row seen -- its start and its id
 * -- and the next page is everything ordered after it, which stays correct
 * however the table changes underneath.
 *
 * Amounts come from `bookingTotals()` (data-model_v2.md §6.1), computed from
 * each row's own add-ons and payments, which the query loads with it: one
 * round trip, whatever the page holds.
 */

export const BOOKINGS_PAGE_SIZE = 25;
export const BOOKINGS_MAX_PAGE_SIZE = 100;
const MINUTES_PER_DAY = 1440;

export type BookingsQuery = {
  /** Empty means every status. */
  statuses?: readonly BookingStatus[];
  /** Kigali dates, inclusive, matched against the shoot's start. */
  from?: KigaliDate;
  to?: KigaliDate;
  /** A reference, a name, an email or a phone number, matched loosely. */
  search?: string;
  cursor?: string;
  limit?: number;
};

export type BookingListRow = {
  id: string;
  reference: string;
  status: string;
  startsAt: string;
  endsAt: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  serviceName: string;
  packageName: string;
  grandTotalRwf: number;
  collectedRwf: number;
  outstandingRwf: number;
  refundDueRwf: number;
  /** Money the photographer owes back, which the list should surface (spec §6.16). */
  hasRefundDue: boolean;
};

export type BookingsPage = {
  bookings: BookingListRow[];
  /** Pass back as `cursor` for the next page; null at the end. */
  nextCursor: string | null;
};

export async function findBookings(prisma: PrismaClient, query: BookingsQuery = {}): Promise<BookingsPage> {
  const limit = Math.min(Math.max(query.limit ?? BOOKINGS_PAGE_SIZE, 1), BOOKINGS_MAX_PAGE_SIZE);
  const where = bookingsWhere(query);

  // One row more than asked for: whether it comes back is whether there is a
  // next page, and no second count query is needed to know.
  const rows = await prisma.booking.findMany({
    where,
    orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    include: {
      addons: { select: { stage: true, amountRwf: true } },
      payments: { select: { status: true, amountRwf: true } },
    },
  });

  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    bookings: page.map(toRow),
    nextCursor: rows.length > limit && last !== undefined ? encodeCursor(last.startsAt, last.id) : null,
  };
}

function bookingsWhere(query: BookingsQuery): Prisma.BookingWhereInput {
  const startsAt: Prisma.DateTimeFilter = {};
  if (query.from !== undefined) startsAt.gte = kigaliMinuteToUtc(query.from, 0);
  if (query.to !== undefined) startsAt.lt = kigaliMinuteToUtc(query.to, MINUTES_PER_DAY);

  const after = query.cursor === undefined ? null : decodeCursor(query.cursor);
  const search = query.search?.trim() ?? '';

  return {
    ...(query.statuses !== undefined && query.statuses.length > 0 ? { status: { in: [...query.statuses] } } : {}),
    ...(Object.keys(startsAt).length > 0 ? { startsAt } : {}),
    // Strictly after the cursor in the list's own order: the same start with a
    // smaller id, or an earlier start.
    ...(after === null
      ? {}
      : {
          OR: [{ startsAt: { lt: after.startsAt } }, { startsAt: after.startsAt, id: { lt: after.id } }],
        }),
    ...(search === ''
      ? {}
      : {
          AND: [
            {
              OR: [
                { reference: { contains: search, mode: 'insensitive' } },
                { contactName: { contains: search, mode: 'insensitive' } },
                { contactEmail: { contains: search, mode: 'insensitive' } },
                { contactPhone: { contains: search, mode: 'insensitive' } },
              ],
            },
          ],
        }),
  };
}

type ListedBooking = Prisma.BookingGetPayload<{
  include: { addons: { select: { stage: true; amountRwf: true } }; payments: { select: { status: true; amountRwf: true } } };
}>;

function toRow(booking: ListedBooking): BookingListRow {
  const totals = bookingTotals(booking, booking.addons, booking.payments);
  return {
    id: booking.id,
    reference: booking.reference,
    status: booking.status,
    startsAt: booking.startsAt.toISOString(),
    endsAt: booking.endsAt.toISOString(),
    contactName: booking.contactName,
    contactEmail: booking.contactEmail,
    contactPhone: booking.contactPhone,
    serviceName: booking.serviceNameSnapshot,
    packageName: booking.packageNameSnapshot,
    grandTotalRwf: totals.grandTotalRwf,
    collectedRwf: totals.collectedRwf,
    outstandingRwf: totals.outstandingRwf,
    refundDueRwf: totals.refundDueRwf,
    hasRefundDue: totals.refundDueRwf > 0,
  };
}

/** What our own ids look like: anything else never reaches the uuid column. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `<start>|<id>`, base64url. Opaque to the caller, who only hands it back. */
export function encodeCursor(startsAt: Date, id: string): string {
  return Buffer.from(`${startsAt.toISOString()}|${id}`).toString('base64url');
}

/** The row a cursor names, or null when it is not one we wrote. */
export function decodeCursor(cursor: string): { startsAt: Date; id: string } | null {
  const [startsAt, id, ...rest] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
  if (startsAt === undefined || id === undefined || rest.length > 0) return null;
  const at = new Date(startsAt);
  if (Number.isNaN(at.getTime()) || !UUID.test(id)) return null;
  return { startsAt: at, id };
}
