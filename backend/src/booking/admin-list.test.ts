import type { Booking, PrismaClient } from '@prisma/client';
import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createPrismaClient } from '../db/client.js';
import { connect, testDatabaseUrl, truncateAll } from '../test/database.js';
import {
  type BookingSeed,
  type PaymentWorld,
  CLIENT,
  insertBooking,
  insertPayment,
  seedWorld,
} from '../test/payment-fixtures.js';
import { BOOKINGS_MAX_PAGE_SIZE, BOOKINGS_PAGE_SIZE, decodeCursor, encodeCursor, findBookings } from './admin-list.js';
import { bookingTotals } from './totals.js';

/**
 * The bookings list (plan.md Task 19; spec §3.6), against real PostgreSQL.
 *
 * What is proven: the status filter takes one status or several; the date
 * bounds are Kigali days and inclusive at both ends -- a shoot at 00:00 on the
 * `from` day and one at 23:59 on the `to` day are both in, one an hour outside
 * either end is not; the search matches reference, name, email and phone
 * case-insensitively; filters combine as AND; the order is `starts_at DESC,
 * id DESC` with the id breaking real ties; and the cursor is stable -- a
 * booking created between two pages neither repeats a row nor skips one, which
 * is the whole reason it is not an OFFSET. The page size defaults to 25 and
 * clamps at 100 however large a limit is asked for, `decodeCursor` refuses
 * anything it did not write, and every money column on a row is
 * `bookingTotals()` and nothing else -- including the status-aware outstanding
 * that is 0 for a no-show, a cancellation or an expired hold.
 *
 * Kigali is UTC+2 with no DST, so `00:00` on 2027-03-10 is 2027-03-09T22:00Z.
 */

let prisma: PrismaClient;
let raw: pg.Client;
let world: PaymentWorld;

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/** The three-day window the date-bound tests filter on. */
const FROM = '2027-03-10';
const TO = '2027-03-12';

beforeAll(async () => {
  prisma = createPrismaClient(testDatabaseUrl());
  raw = connect();
  await raw.connect();
});

afterAll(async () => {
  await truncateAll(raw);
  await prisma.$disconnect();
  await raw.end();
});

beforeEach(async () => {
  await truncateAll(raw);
  world = await seedWorld(prisma);
});

// --- Helpers ----------------------------------------------------------------------------

type Seed = BookingSeed & { contactName?: string; contactEmail?: string; contactPhone?: string };

/** A booking with the contact snapshot a search test needs, which the shared fixture fixes. */
async function book(seed: Seed = {}): Promise<Booking> {
  const { contactName, contactEmail, contactPhone, ...rest } = seed;
  const booking = await insertBooking(prisma, world, rest);
  if (contactName === undefined && contactEmail === undefined && contactPhone === undefined) return booking;
  return prisma.booking.update({
    where: { id: booking.id },
    data: {
      ...(contactName === undefined ? {} : { contactName }),
      ...(contactEmail === undefined ? {} : { contactEmail }),
      ...(contactPhone === undefined ? {} : { contactPhone }),
    },
  });
}

/** A Kigali wall-clock time, as the UTC instant it is. */
function at(date: string, wallTime: string): Date {
  return new Date(`${date}T${wallTime}:00+02:00`);
}

/**
 * `count` bookings an hour apart, written in one statement. Cancelled, so the
 * exclusion constraint has no opinion about any of them, and add-on free, which
 * the paging tests do not read.
 */
async function bulkBookings(count: number, firstStart: Date): Promise<void> {
  await prisma.booking.createMany({
    data: Array.from({ length: count }, (_unused, index) => ({
      reference: `BKY-2703-${String(index).padStart(5, '0')}`,
      clientId: world.clientId,
      contactName: CLIENT.name,
      contactEmail: CLIENT.email,
      contactPhone: CLIENT.phone,
      serviceId: world.serviceId,
      packageId: world.packageId,
      serviceNameSnapshot: 'Portraits',
      packageNameSnapshot: 'Standard',
      packagePriceRwf: 40_000,
      packageDurationMinutes: 30,
      packagePhotoCount: 25,
      status: 'cancelled_by_client',
      startsAt: new Date(firstStart.getTime() + index * HOUR_MS),
      endsAt: new Date(firstStart.getTime() + index * HOUR_MS + 30 * MINUTE_MS),
      bufferEndsAt: new Date(firstStart.getTime() + index * HOUR_MS + 45 * MINUTE_MS),
      locationText: CLIENT.location,
      consentAt: new Date('2026-10-01T06:00:00Z'),
      bookingFeeRate: '0.400',
      bookingFeeRwf: 20_000,
      cancelledAt: new Date('2026-10-01T06:10:00Z'),
    })),
  });
}

/** The references a query answers, in the order it answered them. */
async function references(query: Parameters<typeof findBookings>[1] = {}): Promise<string[]> {
  const page = await findBookings(prisma, query);
  return page.bookings.map((row) => row.reference);
}

// --- The status filter --------------------------------------------------------------------

describe('filtering by status', () => {
  it('answers every booking when no status is named', async () => {
    const confirmed = await book({ status: 'confirmed' });
    const cancelled = await book({ status: 'cancelled_by_admin' });
    const pending = await book();

    expect((await references()).sort()).toEqual([confirmed.reference, cancelled.reference, pending.reference].sort());
    expect((await references({ statuses: [] })).sort()).toEqual(
      [confirmed.reference, cancelled.reference, pending.reference].sort(),
    );
  });

  it('answers only the one status named', async () => {
    const confirmed = await book({ status: 'confirmed' });
    await book({ status: 'cancelled_by_admin' });
    await book();

    expect(await references({ statuses: ['confirmed'] })).toEqual([confirmed.reference]);
  });

  it('answers the union when several statuses are named', async () => {
    const confirmed = await book({ status: 'confirmed' });
    const noShow = await book({ status: 'no_show' });
    await book({ status: 'cancelled_by_admin' });
    await book();

    expect((await references({ statuses: ['confirmed', 'no_show'] })).sort()).toEqual(
      [confirmed.reference, noShow.reference].sort(),
    );
  });

  it('answers nothing for a status nothing holds', async () => {
    await book({ status: 'confirmed' });

    expect(await findBookings(prisma, { statuses: ['expired'] })).toStrictEqual({ bookings: [], nextCursor: null });
  });
});

// --- Kigali date bounds -------------------------------------------------------------------

describe('the from and to bounds, as Kigali days', () => {
  /** Five shoots around a three-day window: two on its edges, one inside, one an hour outside each end. */
  async function aWindowOfShoots() {
    return {
      // 23:00 Kigali the day before `from`: an hour before the window opens.
      beforeFrom: await book({ startsAt: at('2027-03-09', '23:00'), durationMinutes: 15, status: 'confirmed' }),
      fromEdge: await book({ startsAt: at(FROM, '00:00'), status: 'confirmed' }),
      middle: await book({ startsAt: at('2027-03-11', '10:00'), status: 'confirmed' }),
      toEdge: await book({ startsAt: at(TO, '23:59'), durationMinutes: 15, status: 'confirmed' }),
      // 01:00 Kigali the day after `to`: an hour after the window closes.
      afterTo: await book({ startsAt: at('2027-03-13', '01:00'), durationMinutes: 15, status: 'confirmed' }),
    };
  }

  it('includes midnight on the from day and 23:59 on the to day, and excludes an hour outside either end', async () => {
    const shoots = await aWindowOfShoots();

    expect((await references({ from: FROM, to: TO })).sort()).toEqual(
      [shoots.fromEdge.reference, shoots.middle.reference, shoots.toEdge.reference].sort(),
    );
  });

  it('takes from on its own as an open-ended lower bound', async () => {
    const shoots = await aWindowOfShoots();

    expect((await references({ from: FROM })).sort()).toEqual(
      [shoots.fromEdge.reference, shoots.middle.reference, shoots.toEdge.reference, shoots.afterTo.reference].sort(),
    );
  });

  it('takes to on its own as an open-ended upper bound', async () => {
    const shoots = await aWindowOfShoots();

    expect((await references({ to: TO })).sort()).toEqual(
      [shoots.beforeFrom.reference, shoots.fromEdge.reference, shoots.middle.reference, shoots.toEdge.reference].sort(),
    );
  });

  it('answers a single Kigali day when from and to are the same date', async () => {
    const shoots = await aWindowOfShoots();

    expect(await references({ from: '2027-03-11', to: '2027-03-11' })).toEqual([shoots.middle.reference]);
  });

  it('answers nothing when the window closes before it opens', async () => {
    await aWindowOfShoots();

    expect(await references({ from: TO, to: FROM })).toEqual([]);
  });
});

// --- Search -------------------------------------------------------------------------------

describe('searching', () => {
  async function threeClients() {
    return {
      aline: await book({
        reference: 'BKY-2703-AAAAA',
        contactName: 'Aline Uwase',
        contactEmail: 'aline@example.com',
        contactPhone: '+250788111111',
        status: 'confirmed',
      }),
      eric: await book({
        reference: 'BKY-2703-BBBBB',
        contactName: 'Eric Habimana',
        contactEmail: 'eric.habimana@mail.example',
        contactPhone: '+250722222222',
        status: 'confirmed',
      }),
      grace: await book({
        reference: 'BKY-2703-CCCCC',
        contactName: 'Grace MUKAMANA',
        contactEmail: 'grace@studio.example',
        contactPhone: '+250733333333',
        status: 'confirmed',
      }),
    };
  }

  it.each([
    ['a whole reference', 'BKY-2703-BBBBB', 'eric'],
    ['part of a reference, in the wrong case', 'bbbbb', 'eric'],
    ['a name', 'Uwase', 'aline'],
    ['a name in the wrong case', 'mukamana', 'grace'],
    ['an email', 'ERIC.HABIMANA@MAIL.EXAMPLE', 'eric'],
    ['part of an email domain', 'studio.example', 'grace'],
    ['part of a phone number', '788111', 'aline'],
  ] as const)('matches %s', async (_case, search, who) => {
    const clients = await threeClients();

    expect(await references({ search })).toEqual([clients[who].reference]);
  });

  it('matches nothing a booking does not hold', async () => {
    await threeClients();

    expect(await references({ search: 'nobody-by-that-name' })).toEqual([]);
  });

  it('ignores a search that is only whitespace, answering everything', async () => {
    const clients = await threeClients();

    expect((await references({ search: '   ' })).sort()).toEqual(
      [clients.aline.reference, clients.eric.reference, clients.grace.reference].sort(),
    );
  });

  it('trims what it is given before matching', async () => {
    const clients = await threeClients();

    expect(await references({ search: '  Uwase  ' })).toEqual([clients.aline.reference]);
  });
});

// --- Filters together ---------------------------------------------------------------------

describe('filters combined', () => {
  it('applies status, dates and search together as one AND', async () => {
    const wanted = await book({
      startsAt: at('2027-03-11', '10:00'),
      status: 'confirmed',
      contactName: 'Aline Uwase',
    });
    // Right name and date, wrong status.
    await book({ startsAt: at('2027-03-11', '14:00'), status: 'cancelled_by_admin', contactName: 'Aline Uwase' });
    // Right name and status, outside the window.
    await book({ startsAt: at('2027-03-20', '10:00'), status: 'confirmed', contactName: 'Aline Uwase' });
    // Right status and date, wrong name.
    await book({ startsAt: at('2027-03-11', '16:00'), status: 'confirmed', contactName: 'Eric Habimana' });

    expect(await references({ statuses: ['confirmed'], from: FROM, to: TO, search: 'uwase' })).toEqual([wanted.reference]);
  });
});

// --- Order --------------------------------------------------------------------------------

describe('the order', () => {
  it('puts the latest shoot first', async () => {
    const early = await book({ startsAt: at('2027-03-10', '09:00'), status: 'confirmed' });
    const late = await book({ startsAt: at('2027-03-12', '09:00'), status: 'confirmed' });
    const middle = await book({ startsAt: at('2027-03-11', '09:00'), status: 'confirmed' });

    expect(await references()).toEqual([late.reference, middle.reference, early.reference]);
  });

  it('breaks a tie on the same start by id, descending', async () => {
    const startsAt = at('2027-03-11', '09:00');
    // Cancelled, so two bookings may share an instant without the exclusion
    // constraint having a view.
    const first = await book({ startsAt, status: 'cancelled_by_client' });
    const second = await book({ startsAt, status: 'cancelled_by_client' });
    const expected = [first, second].sort((a, b) => (a.id < b.id ? 1 : -1)).map((row) => row.reference);

    expect(await references()).toEqual(expected);
  });
});

// --- Cursor paging ------------------------------------------------------------------------

describe('paging by cursor', () => {
  /** Five bookings an hour apart, newest first: the order the list will use. */
  async function inOrder(): Promise<string[]> {
    const created: Booking[] = [];
    for (let index = 0; index < 5; index += 1) {
      created.push(
        await book({
          startsAt: new Date(at('2027-03-11', '09:00').getTime() + index * HOUR_MS),
          durationMinutes: 30,
          status: 'confirmed',
        }),
      );
    }
    return created
      .slice()
      .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())
      .map((row) => row.reference);
  }

  it('walks the whole list two rows at a time and ends with a null cursor', async () => {
    const shoots = await inOrder();

    const first = await findBookings(prisma, { limit: 2 });
    expect(first.bookings.map((row) => row.reference)).toEqual([shoots[0], shoots[1]]);
    expect(first.nextCursor).not.toBeNull();

    const second = await findBookings(prisma, { limit: 2, cursor: first.nextCursor ?? '' });
    expect(second.bookings.map((row) => row.reference)).toEqual([shoots[2], shoots[3]]);
    expect(second.nextCursor).not.toBeNull();

    const third = await findBookings(prisma, { limit: 2, cursor: second.nextCursor ?? '' });
    expect(third.bookings.map((row) => row.reference)).toEqual([shoots[4]]);
    expect(third.nextCursor).toBeNull();
  });

  it('skips and repeats nothing when a newer booking is made between two pages', async () => {
    const shoots = await inOrder();

    const first = await findBookings(prisma, { limit: 2 });
    // A booking made after page 1 was read, later than everything on it. An
    // OFFSET would now shift every later row down and repeat the last one.
    await book({ startsAt: at('2027-03-20', '09:00'), status: 'confirmed' });
    const second = await findBookings(prisma, { limit: 2, cursor: first.nextCursor ?? '' });
    const third = await findBookings(prisma, { limit: 2, cursor: second.nextCursor ?? '' });

    const walked = [...first.bookings, ...second.bookings, ...third.bookings].map((row) => row.reference);
    expect(walked).toEqual(shoots);
    expect(new Set(walked).size).toBe(walked.length);
    expect(third.nextCursor).toBeNull();
  });

  it('answers a null cursor when the last page is exactly full', async () => {
    await inOrder();

    const page = await findBookings(prisma, { limit: 5 });

    expect(page.bookings).toHaveLength(5);
    expect(page.nextCursor).toBeNull();
  });

  it('answers nothing, with no cursor, past the end of the list', async () => {
    const shoots = await inOrder();
    const all = await findBookings(prisma, { limit: 5 });
    expect(all.bookings.map((row) => row.reference)).toEqual(shoots);

    const past = await findBookings(prisma, { limit: 5, cursor: encodeCursor(new Date('2000-01-01T00:00:00Z'), all.bookings[0]?.id ?? '') });

    expect(past).toStrictEqual({ bookings: [], nextCursor: null });
  });

  it('carries its filter with it: a cursor page is still filtered', async () => {
    await book({ startsAt: at('2027-03-11', '09:00'), status: 'confirmed' });
    const cancelledLate = await book({ startsAt: at('2027-03-11', '12:00'), status: 'cancelled_by_admin' });
    const cancelledEarly = await book({ startsAt: at('2027-03-11', '06:00'), status: 'cancelled_by_admin' });

    const first = await findBookings(prisma, { statuses: ['cancelled_by_admin'], limit: 1 });
    expect(first.bookings.map((row) => row.reference)).toEqual([cancelledLate.reference]);

    const second = await findBookings(prisma, { statuses: ['cancelled_by_admin'], limit: 1, cursor: first.nextCursor ?? '' });
    expect(second.bookings.map((row) => row.reference)).toEqual([cancelledEarly.reference]);
    expect(second.nextCursor).toBeNull();
  });
});

// --- Page size ----------------------------------------------------------------------------

describe('the page size', () => {
  it('defaults to 25 and reports there is more', async () => {
    await bulkBookings(BOOKINGS_PAGE_SIZE + 1, at('2027-03-11', '09:00'));

    const page = await findBookings(prisma);

    expect(BOOKINGS_PAGE_SIZE).toBe(25);
    expect(page.bookings).toHaveLength(BOOKINGS_PAGE_SIZE);
    expect(page.nextCursor).not.toBeNull();
  });

  it('clamps at 100 however large a limit is asked for', async () => {
    await bulkBookings(BOOKINGS_MAX_PAGE_SIZE + 1, at('2027-03-11', '09:00'));

    expect(BOOKINGS_MAX_PAGE_SIZE).toBe(100);
    expect((await findBookings(prisma, { limit: 1_000_000 })).bookings).toHaveLength(BOOKINGS_MAX_PAGE_SIZE);
    expect((await findBookings(prisma, { limit: BOOKINGS_MAX_PAGE_SIZE })).bookings).toHaveLength(BOOKINGS_MAX_PAGE_SIZE);
  });

  it('clamps a zero or negative limit up to one row', async () => {
    await bulkBookings(3, at('2027-03-11', '09:00'));

    expect((await findBookings(prisma, { limit: 0 })).bookings).toHaveLength(1);
    expect((await findBookings(prisma, { limit: -10 })).bookings).toHaveLength(1);
  });
});

// --- The cursor itself --------------------------------------------------------------------

describe('encodeCursor and decodeCursor', () => {
  it('round-trips a start and an id', () => {
    const startsAt = new Date('2027-03-11T07:00:00.000Z');
    const id = '3f1b9c2a-0000-4000-8000-00000000abcd';

    const decoded = decodeCursor(encodeCursor(startsAt, id));

    expect(decoded).not.toBeNull();
    expect(decoded?.startsAt.toISOString()).toBe(startsAt.toISOString());
    expect(decoded?.id).toBe(id);
  });

  it('is opaque base64url, carrying no separator a URL would have to escape', () => {
    const cursor = encodeCursor(new Date('2027-03-11T07:00:00.000Z'), '3f1b9c2a-0000-4000-8000-00000000abcd');

    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(encodeURIComponent(cursor)).toBe(cursor);
  });

  it.each([
    ['empty', ''],
    ['not base64 at all', '!!!not-base64!!!'],
    ['base64 of nothing', Buffer.from('').toString('base64url')],
    ['no separator', Buffer.from('2027-03-11T07:00:00.000Z').toString('base64url')],
    ['a separator too many', Buffer.from('2027-03-11T07:00:00.000Z|3f1b9c2a-0000-4000-8000-00000000abcd|extra').toString('base64url')],
    ['an unparseable date', Buffer.from('not-a-date|3f1b9c2a-0000-4000-8000-00000000abcd').toString('base64url')],
    ['an empty date', Buffer.from('|3f1b9c2a-0000-4000-8000-00000000abcd').toString('base64url')],
    ['an id that is not a uuid', Buffer.from('2027-03-11T07:00:00.000Z|nope').toString('base64url')],
    ['an id with a letter past f', Buffer.from('2027-03-11T07:00:00.000Z|3f1b9c2a-0000-4000-8000-00000000abcz').toString('base64url')],
  ])('refuses a cursor with %s', (_case, cursor) => {
    expect(decodeCursor(cursor)).toBeNull();
  });

  /**
   * FAILING, and left failing deliberately. `admin-list.ts:156` checks the id
   * with `/^[0-9a-f-]{36}$/i`, which is 36 characters of hex OR dashes in any
   * arrangement -- not a uuid. Anything that gets past it goes straight into a
   * `where` on `booking.id`, a `uuid` column, and PostgreSQL raises 22P02
   * "invalid input syntax for type uuid", which surfaces as a 500 from
   * `GET /api/admin/bookings` (see routes/admin-bookings.test.ts, "answers a
   * crafted cursor ... without a 500"). The docblock says this function answers
   * "null when it is not one we wrote"; these are not ones we wrote.
   */
  it.each([
    ['thirty-six dashes', '-'.repeat(36)],
    ['thirty-six hex digits with no dashes', '0'.repeat(36)],
    ['dashes in the wrong places', '3f1b9c2a0000-4000-8000-00000000ab-cd'],
  ])('refuses an id of %s, which is not a uuid', (_case, id) => {
    expect(decodeCursor(Buffer.from(`2027-03-11T07:00:00.000Z|${id}`).toString('base64url'))).toBeNull();
  });

  it('a cursor it refuses is simply ignored, not an error, so the list still answers', async () => {
    const booking = await book({ status: 'confirmed' });

    expect(await references({ cursor: 'not-a-cursor-we-wrote' })).toEqual([booking.reference]);
  });
});

// --- Money on a row -----------------------------------------------------------------------

describe('each row’s money', () => {
  it('is bookingTotals(), add-ons and payments included', async () => {
    const booking = await book({ status: 'confirmed', addons: ['own', 'shared'] });
    await insertPayment(prisma, booking.id, { status: 'succeeded', amountRwf: 22_000 });

    const row = (await findBookings(prisma)).bookings[0];
    const expected = bookingTotals(
      { status: 'confirmed', packagePriceRwf: 40_000 },
      [
        { stage: 'at_booking', amountRwf: 10_000 },
        { stage: 'at_booking', amountRwf: 5_000 },
      ],
      [{ status: 'succeeded', amountRwf: 22_000 }],
    );

    expect(row).toMatchObject({
      reference: booking.reference,
      grandTotalRwf: expected.grandTotalRwf,
      collectedRwf: expected.collectedRwf,
      outstandingRwf: expected.outstandingRwf,
      refundDueRwf: expected.refundDueRwf,
      hasRefundDue: false,
    });
    expect([expected.grandTotalRwf, expected.collectedRwf, expected.outstandingRwf]).toEqual([55_000, 22_000, 33_000]);
  });

  it('counts a post-shoot add-on into the grand total and what is owed', async () => {
    const booking = await book({ status: 'completed', startsAt: at('2027-03-01', '09:00') });
    await prisma.bookingAddon.create({
      data: {
        bookingId: booking.id,
        addonId: world.sharedAddonId,
        nameSnapshot: 'Rush edit',
        unitPriceRwf: 15_000,
        amountRwf: 15_000,
        stage: 'post_shoot',
      },
    });
    await insertPayment(prisma, booking.id, { status: 'succeeded', amountRwf: 20_000 });

    const row = (await findBookings(prisma)).bookings[0];

    expect(row).toMatchObject({ grandTotalRwf: 65_000, collectedRwf: 20_000, outstandingRwf: 45_000 });
  });

  it('surfaces money owed back, without netting it off what was collected', async () => {
    const booking = await book({ status: 'cancelled_by_admin' });
    await insertPayment(prisma, booking.id, { status: 'refund_due', amountRwf: 20_000 });

    const row = (await findBookings(prisma)).bookings[0];

    expect(row).toMatchObject({ collectedRwf: 0, refundDueRwf: 20_000, hasRefundDue: true, outstandingRwf: 0 });
  });

  it.each(['no_show', 'cancelled_by_client', 'cancelled_by_admin', 'expired'] as const)(
    'owes nothing on a %s booking, whatever the package cost',
    async (status) => {
      const booking = await book({ status });
      await insertPayment(prisma, booking.id, { status: 'succeeded', amountRwf: 20_000 });

      const row = (await findBookings(prisma)).bookings[0];

      expect(row).toMatchObject({ reference: booking.reference, status, grandTotalRwf: 50_000, outstandingRwf: 0 });
    },
  );

  it.each(['pending_payment', 'confirmed', 'completed'] as const)('still owes on a %s booking', async (status) => {
    const booking = await book({ status, startsAt: at('2027-03-01', '09:00') });
    await insertPayment(prisma, booking.id, { status: 'succeeded', amountRwf: 20_000 });

    const row = (await findBookings(prisma)).bookings[0];

    expect(row).toMatchObject({ reference: booking.reference, outstandingRwf: 30_000 });
  });

  it('ignores an unsettled attempt: only money collected counts', async () => {
    const booking = await book({ status: 'confirmed' });
    await insertPayment(prisma, booking.id, { status: 'pending', amountRwf: 20_000, ageSeconds: 300 });
    await insertPayment(prisma, booking.id, { status: 'failed', amountRwf: 20_000, ageSeconds: 200 });

    const row = (await findBookings(prisma)).bookings[0];

    expect(row).toMatchObject({ collectedRwf: 0, refundDueRwf: 0, outstandingRwf: 50_000 });
  });

  it('carries the contact and catalogue snapshots a list needs, and no access token', async () => {
    const booking = await book({ status: 'confirmed' });

    const row = (await findBookings(prisma)).bookings[0];

    expect(row).toMatchObject({
      id: booking.id,
      reference: booking.reference,
      status: 'confirmed',
      startsAt: booking.startsAt.toISOString(),
      endsAt: booking.endsAt.toISOString(),
      contactName: CLIENT.name,
      contactEmail: CLIENT.email,
      contactPhone: CLIENT.phone,
      serviceName: 'Portraits',
      packageName: 'Standard',
    });
    expect(JSON.stringify(row)).not.toMatch(/accessToken|access_token/i);
  });
});
