import type { AdminUser, PrismaClient } from '@prisma/client';
import type { Express } from 'express';
import type pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { issueAdminToken } from '../auth/token.js';
import { encodeCursor } from '../booking/admin-list.js';
import { type AdminBooking, adminBookingView, findAdminBooking } from '../booking/admin-view.js';
import { createPrismaClient } from '../db/client.js';
import { connect, testDatabaseUrl, truncateAll } from '../test/database.js';
import {
  type PaymentWorld,
  CLIENT,
  insertBooking,
  insertBookingWithToken,
  insertPayment,
  seedWorld,
} from '../test/payment-fixtures.js';

/**
 * `/api/admin/bookings` and `/api/admin/payments/:id/refund` over HTTP (plan.md
 * Task 19; spec §3.6, §6.11, §6.12, §6.16, §6.21, §7), against real PostgreSQL.
 *
 * The behaviour of each action is proven in booking/admin-actions.test.ts and
 * payments/refund.test.ts. What is proven here is the HTTP contract: every
 * route sits behind `requireAdmin`, so no token, a forged one or an expired one
 * is 401 and nothing else; the list's query is parsed by the one admin rule
 * (400 for a malformed request, 422 for a value outside its range) and a cursor
 * it did not write is simply ignored; an unknown booking is 404 and a malformed
 * id is 400, not 404; and every answer -- including every refusal -- is the
 * booking as `adminBookingView` renders it.
 *
 * That last part is the point of the 409s. A screen that acted on a stale view
 * gets back what is true, not only that it was wrong, so it can correct itself
 * without a second request.
 */

let prisma: PrismaClient;
let raw: pg.Client;
let world: PaymentWorld;
let admin: AdminUser;
let token: string;
let clock: Date;
let app: Express;

const SECRET = 'admin-bookings-test-secret-at-least-32-characters';
const OTHER_SECRET = 'a-different-secret-that-is-also-at-least-32-chars';
const WEB_ORIGIN = 'https://admin.bookly.example';
/** Long before every fixture shoot (January 2027). */
const START = new Date('2026-10-01T06:00:00Z');
/** After every fixture shoot, for the actions that need one to have started. */
const AFTER_THE_SHOOT = new Date('2027-06-01T06:00:00Z');
const HOUR_MS = 3_600_000;

const BOOKINGS = '/api/admin/bookings';
const UNKNOWN_ID = '3f1b9c2a-0000-4000-8000-00000000abcd';

const WEDNESDAY_0900 = new Date('2027-01-06T07:00:00Z');
const WEDNESDAY_1400 = new Date('2027-01-06T12:00:00Z');
const THURSDAY_0900 = new Date('2027-01-07T07:00:00Z');

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
  clock = START;
  world = await seedWorld(prisma);
  admin = await prisma.adminUser.findFirstOrThrow();
  token = (await issueAdminToken(SECRET, admin, START)).token;
  app = createApp({
    corsOrigin: WEB_ORIGIN,
    admin: { prisma, sessionSecret: SECRET, webOrigin: WEB_ORIGIN, now: () => clock },
  });
});

// --- Helpers ----------------------------------------------------------------------------

function get(path: string, bearer: string | null = token) {
  const call = request(app).get(path);
  return bearer === null ? call : call.set('Authorization', `Bearer ${bearer}`);
}

function post(path: string, body: unknown = {}, bearer: string | null = token) {
  const call = request(app).post(path).send(body as object);
  return bearer === null ? call : call.set('Authorization', `Bearer ${bearer}`);
}

/** Moves the injected clock, re-issuing the bearer token so it is still live. */
async function travelTo(at: Date): Promise<void> {
  clock = at;
  token = (await issueAdminToken(SECRET, admin, at)).token;
}

async function adminBooking(id: string): Promise<AdminBooking> {
  const booking = await findAdminBooking(prisma, id);
  if (booking === null) throw new Error('No such booking');
  return booking;
}

/** The booking exactly as the route renders it, for a whole-body comparison. */
async function renderedBooking(id: string, at: Date = clock): Promise<unknown> {
  return JSON.parse(JSON.stringify(adminBookingView(await adminBooking(id), at)));
}

/** A confirmed booking with a live link and a settled booking fee. */
async function confirmedBooking(startsAt: Date = WEDNESDAY_0900) {
  const { booking } = await insertBookingWithToken(prisma, world, { startsAt });
  const payment = await insertPayment(prisma, booking.id, { status: 'succeeded', amountRwf: 20_000 });
  return { booking, payment };
}

// --- Authentication ---------------------------------------------------------------------

describe('every route is behind requireAdmin (spec §2.2)', () => {
  async function everyRoute(): Promise<{ label: string; call: (bearer: string | null) => request.Test }[]> {
    const { booking, payment } = await confirmedBooking();
    return [
      { label: 'GET /bookings', call: (bearer) => get(BOOKINGS, bearer) },
      { label: 'GET /bookings/:id', call: (bearer) => get(`${BOOKINGS}/${booking.id}`, bearer) },
      {
        label: 'POST /bookings/:id/reschedule',
        call: (bearer) => post(`${BOOKINGS}/${booking.id}/reschedule`, { startsAt: THURSDAY_0900.toISOString() }, bearer),
      },
      { label: 'POST /bookings/:id/cancel', call: (bearer) => post(`${BOOKINGS}/${booking.id}/cancel`, {}, bearer) },
      { label: 'POST /bookings/:id/complete', call: (bearer) => post(`${BOOKINGS}/${booking.id}/complete`, {}, bearer) },
      { label: 'POST /bookings/:id/no-show', call: (bearer) => post(`${BOOKINGS}/${booking.id}/no-show`, {}, bearer) },
      { label: 'POST /bookings/:id/resend-link', call: (bearer) => post(`${BOOKINGS}/${booking.id}/resend-link`, {}, bearer) },
      {
        label: 'POST /payments/:id/refund',
        call: (bearer) => post(`/api/admin/payments/${payment.id}/refund`, { reference: 'MOMO-1' }, bearer),
      },
    ];
  }

  it('answers 401 with no token at all, and changes nothing', async () => {
    for (const route of await everyRoute()) {
      const res = await route.call(null);
      expect([route.label, res.status, res.body]).toEqual([route.label, 401, { error: 'unauthenticated' }]);
      expect(res.headers['www-authenticate']).toBe('Bearer realm="bookly-admin"');
    }
  });

  it('answers 401 for a token that is not one of ours', async () => {
    const forged = (await issueAdminToken(OTHER_SECRET, admin, START)).token;

    for (const route of await everyRoute()) {
      for (const bearer of ['not-a-jwt', forged]) {
        const res = await route.call(bearer);
        expect([route.label, bearer, res.status]).toEqual([route.label, bearer, 401]);
      }
    }
  });

  it('answers 401 for a token that has expired', async () => {
    const stale = (await issueAdminToken(SECRET, admin, new Date(START.getTime() - 9 * HOUR_MS))).token;

    for (const route of await everyRoute()) {
      const res = await route.call(stale);
      expect([route.label, res.status, res.headers['www-authenticate']]).toEqual([
        route.label,
        401,
        'Bearer realm="bookly-admin", error="invalid_token"',
      ]);
    }
  });

  it('leaves the booking untouched when the token is refused', async () => {
    const { booking } = await confirmedBooking();

    await post(`${BOOKINGS}/${booking.id}/cancel`, { reason: 'nope' }, null);

    expect((await adminBooking(booking.id)).status).toBe('confirmed');
  });

  it('answers 401, not 404, for a path under /api/admin that does not exist', async () => {
    const res = await get('/api/admin/bookings/nope/nope/nope', null);

    expect(res.status).toBe(401);
  });
});

// --- The list ---------------------------------------------------------------------------

describe('GET /bookings', () => {
  it('answers every booking, newest shoot first, with a null cursor on the last page', async () => {
    const early = await insertBooking(prisma, world, { status: 'confirmed', startsAt: WEDNESDAY_0900 });
    const late = await insertBooking(prisma, world, { status: 'confirmed', startsAt: THURSDAY_0900 });

    const res = await get(BOOKINGS);

    expect(res.status).toBe(200);
    expect(res.body.bookings.map((row: { reference: string }) => row.reference)).toEqual([late.reference, early.reference]);
    expect(res.body.nextCursor).toBeNull();
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  it('carries each row’s money, derived and not stored', async () => {
    const booking = await insertBooking(prisma, world, { status: 'confirmed', startsAt: WEDNESDAY_0900 });
    await insertPayment(prisma, booking.id, { status: 'succeeded', amountRwf: 20_000 });

    const res = await get(BOOKINGS);

    expect(res.body.bookings[0]).toMatchObject({
      reference: booking.reference,
      contactName: CLIENT.name,
      grandTotalRwf: 50_000,
      collectedRwf: 20_000,
      outstandingRwf: 30_000,
      refundDueRwf: 0,
      hasRefundDue: false,
    });
  });

  it('filters by one status', async () => {
    const confirmed = await insertBooking(prisma, world, { status: 'confirmed', startsAt: WEDNESDAY_0900 });
    await insertBooking(prisma, world, { status: 'cancelled_by_admin', startsAt: THURSDAY_0900 });

    const res = await get(`${BOOKINGS}?status=confirmed`);

    expect(res.body.bookings.map((row: { reference: string }) => row.reference)).toEqual([confirmed.reference]);
  });

  it('takes status repeated, as ?status=a&status=b', async () => {
    const confirmed = await insertBooking(prisma, world, { status: 'confirmed', startsAt: WEDNESDAY_0900 });
    const cancelled = await insertBooking(prisma, world, { status: 'cancelled_by_admin', startsAt: THURSDAY_0900 });
    await insertBooking(prisma, world, { status: 'expired', startsAt: new Date('2027-01-08T07:00:00Z') });

    const res = await get(`${BOOKINGS}?status=confirmed&status=cancelled_by_admin`);

    expect(res.body.bookings.map((row: { reference: string }) => row.reference).sort()).toEqual(
      [confirmed.reference, cancelled.reference].sort(),
    );
  });

  it('filters by a Kigali date range, inclusive at both ends', async () => {
    const inside = await insertBooking(prisma, world, { status: 'confirmed', startsAt: WEDNESDAY_0900 });
    await insertBooking(prisma, world, { status: 'confirmed', startsAt: new Date('2027-01-20T07:00:00Z') });

    const res = await get(`${BOOKINGS}?from=2027-01-06&to=2027-01-06`);

    expect(res.body.bookings.map((row: { reference: string }) => row.reference)).toEqual([inside.reference]);
  });

  it('searches reference, name, email and phone', async () => {
    const booking = await insertBooking(prisma, world, { status: 'confirmed', startsAt: WEDNESDAY_0900 });
    await prisma.booking.update({ where: { id: booking.id }, data: { contactName: 'Grace Mukamana' } });
    await insertBooking(prisma, world, { status: 'confirmed', startsAt: THURSDAY_0900 });

    const res = await get(`${BOOKINGS}?search=mukamana`);

    expect(res.body.bookings.map((row: { reference: string }) => row.reference)).toEqual([booking.reference]);
  });

  it('pages with the cursor it handed back', async () => {
    const early = await insertBooking(prisma, world, { status: 'confirmed', startsAt: WEDNESDAY_0900 });
    const late = await insertBooking(prisma, world, { status: 'confirmed', startsAt: THURSDAY_0900 });

    const first = await get(`${BOOKINGS}?limit=1`);
    expect(first.body.bookings.map((row: { reference: string }) => row.reference)).toEqual([late.reference]);
    expect(typeof first.body.nextCursor).toBe('string');

    const second = await get(`${BOOKINGS}?limit=1&cursor=${encodeURIComponent(first.body.nextCursor)}`);

    expect(second.body.bookings.map((row: { reference: string }) => row.reference)).toEqual([early.reference]);
    expect(second.body.nextCursor).toBeNull();
  });

  it('ignores a cursor it did not write rather than failing', async () => {
    const booking = await insertBooking(prisma, world, { status: 'confirmed', startsAt: WEDNESDAY_0900 });

    const res = await get(`${BOOKINGS}?cursor=not-a-cursor-we-wrote`);

    expect(res.status).toBe(200);
    expect(res.body.bookings.map((row: { reference: string }) => row.reference)).toEqual([booking.reference]);
  });

  /**
   * FAILING, and left failing deliberately: this answers 500 `internal_error`.
   * `admin-list.ts:156` checks a cursor's id with `/^[0-9a-f-]{36}$/i`, which
   * matches 36 dashes, so the string reaches a `where` on `booking.id` and
   * PostgreSQL raises 22P02, "invalid input syntax for type uuid". The root
   * cause has its own failing test in booking/admin-list.test.ts.
   */
  it('answers a crafted cursor that is not one we wrote without a 500', async () => {
    await insertBooking(prisma, world, { status: 'confirmed', startsAt: WEDNESDAY_0900 });
    const cursor = Buffer.from(`2027-01-01T00:00:00.000Z|${'-'.repeat(36)}`).toString('base64url');

    const res = await get(`${BOOKINGS}?cursor=${encodeURIComponent(cursor)}`);

    expect(res.status).toBeLessThan(500);
  });

  it('accepts a cursor for a row that no longer exists, answering what follows it', async () => {
    await insertBooking(prisma, world, { status: 'confirmed', startsAt: WEDNESDAY_0900 });
    const cursor = encodeCursor(new Date('2000-01-01T00:00:00Z'), UNKNOWN_ID);

    const res = await get(`${BOOKINGS}?cursor=${encodeURIComponent(cursor)}`);

    expect([res.status, res.body]).toEqual([200, { bookings: [], nextCursor: null }]);
  });

  it.each([
    ['a status outside the vocabulary', 'status=declined', 400],
    ['a malformed date', 'from=2026-13-40', 400],
    ['a date the engine refuses', 'from=0050-01-01', 422],
    ['a limit that is not a number', 'limit=plenty', 400],
    ['a limit of zero', 'limit=0', 422],
    ['a limit past the maximum', 'limit=101', 422],
    ['an unknown query key', 'sort=price', 400],
    ['a search longer than 200 characters', `search=${'x'.repeat(201)}`, 422],
    ['a cursor longer than 500 characters', `cursor=${'x'.repeat(501)}`, 422],
  ])('refuses %s with %s', async (_case, query, status) => {
    const res = await get(`${BOOKINGS}?${query}`);

    expect([res.status, res.body.error]).toEqual([status, status === 400 ? 'invalid_request' : 'validation_failed']);
  });
});

// --- One booking ------------------------------------------------------------------------

describe('GET /bookings/:id', () => {
  it('answers the booking exactly as adminBookingView renders it', async () => {
    const { booking } = await confirmedBooking();

    const res = await get(`${BOOKINGS}/${booking.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toStrictEqual({ booking: await renderedBooking(booking.id) });
    expect(res.body.booking).toMatchObject({
      id: booking.id,
      reference: booking.reference,
      status: 'confirmed',
      contact: { name: CLIENT.name, email: CLIENT.email, phone: CLIENT.phone },
      actions: { canReschedule: true, canCancel: true, canComplete: false, canMarkNoShow: false, canResendLink: true },
    });
  });

  it('carries the payments, the messages and the money, and never the access token', async () => {
    const { booking } = await confirmedBooking();

    const res = await get(`${BOOKINGS}/${booking.id}`);

    expect(res.body.booking.payments).toHaveLength(1);
    expect(res.body.booking.payments[0]).toMatchObject({ kind: 'booking_fee', status: 'succeeded', canRecordRefund: false });
    expect(res.body.booking.money.totals).toMatchObject({ grandTotalRwf: 50_000, collectedRwf: 20_000, outstandingRwf: 30_000 });
    expect(res.body.booking.access).toMatchObject({ hasLink: true });
    expect(JSON.stringify(res.body)).not.toMatch(/accessToken|access_token|Hash/i);
  });

  it('answers 404 for a booking that does not exist', async () => {
    const res = await get(`${BOOKINGS}/${UNKNOWN_ID}`);

    expect([res.status, res.body]).toEqual([404, { error: 'not_found' }]);
  });

  it('answers 400 for an id that is not a uuid: a malformed request, not a missing row', async () => {
    const res = await get(`${BOOKINGS}/not-a-uuid`);

    expect([res.status, res.body]).toEqual([400, { error: 'invalid_request' }]);
  });
});

// --- Reschedule --------------------------------------------------------------------------

describe('POST /bookings/:id/reschedule', () => {
  it('moves the booking and answers it at its new time', async () => {
    const { booking } = await confirmedBooking();

    const res = await post(`${BOOKINGS}/${booking.id}/reschedule`, { startsAt: THURSDAY_0900.toISOString() });

    expect(res.status).toBe(200);
    expect(res.body).toStrictEqual({ booking: await renderedBooking(booking.id) });
    expect(res.body.booking.schedule).toMatchObject({
      startsAt: THURSDAY_0900.toISOString(),
      originalStartsAt: WEDNESDAY_0900.toISOString(),
      rescheduledAt: START.toISOString(),
    });
  });

  it('accepts a Kigali wall time with its +02:00 offset, as the admin screen sends it', async () => {
    const { booking } = await confirmedBooking();

    const res = await post(`${BOOKINGS}/${booking.id}/reschedule`, { startsAt: '2027-01-07T09:00:00+02:00' });

    expect(res.status).toBe(200);
    expect(res.body.booking.schedule.startsAt).toBe(THURSDAY_0900.toISOString());
  });

  it('answers 409 slot_taken carrying the booking as it still stands', async () => {
    const { booking } = await confirmedBooking();
    await insertBooking(prisma, world, { status: 'confirmed', startsAt: THURSDAY_0900 });

    const res = await post(`${BOOKINGS}/${booking.id}/reschedule`, { startsAt: THURSDAY_0900.toISOString() });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('slot_taken');
    expect(res.body.booking).toStrictEqual(await renderedBooking(booking.id));
    expect(res.body.booking.schedule.startsAt).toBe(WEDNESDAY_0900.toISOString());
  });

  it('answers 409 unchanged for the time the booking already has', async () => {
    const { booking } = await confirmedBooking();

    const res = await post(`${BOOKINGS}/${booking.id}/reschedule`, { startsAt: WEDNESDAY_0900.toISOString() });

    expect([res.status, res.body.error]).toEqual([409, 'unchanged']);
    expect(res.body.booking.schedule.startsAt).toBe(WEDNESDAY_0900.toISOString());
  });

  it('answers 409 not_allowed carrying the booking, so a stale screen corrects itself', async () => {
    const { booking } = await confirmedBooking();
    // Cancelled in another tab while this screen still showed it confirmed.
    await post(`${BOOKINGS}/${booking.id}/cancel`, { reason: 'Studio flooded.' });

    const res = await post(`${BOOKINGS}/${booking.id}/reschedule`, { startsAt: THURSDAY_0900.toISOString() });

    expect([res.status, res.body.error]).toEqual([409, 'not_allowed']);
    expect(res.body.booking).toMatchObject({
      status: 'cancelled_by_admin',
      lifecycle: { cancellationReason: 'Studio flooded.' },
      actions: { canReschedule: false, canCancel: false },
    });
  });

  it('answers 404 for a booking that does not exist', async () => {
    const res = await post(`${BOOKINGS}/${UNKNOWN_ID}/reschedule`, { startsAt: THURSDAY_0900.toISOString() });

    expect([res.status, res.body]).toEqual([404, { error: 'not_found' }]);
  });

  it.each([
    ['no body at all', {}],
    ['a startsAt with no offset', { startsAt: '2027-01-07T07:00:00' }],
    ['a startsAt that is not a date', { startsAt: 'tomorrow' }],
    ['a startsAt that is not a string', { startsAt: 1_767_769_200_000 }],
    ['an unknown key beside it', { startsAt: '2027-01-07T07:00:00Z', force: true }],
  ])('refuses %s with 400', async (_case, body) => {
    const { booking } = await confirmedBooking();

    const res = await post(`${BOOKINGS}/${booking.id}/reschedule`, body);

    expect([res.status, res.body]).toEqual([400, { error: 'invalid_request' }]);
    expect((await adminBooking(booking.id)).startsAt).toStrictEqual(WEDNESDAY_0900);
  });
});

// --- Cancel ------------------------------------------------------------------------------

describe('POST /bookings/:id/cancel', () => {
  it('cancels with a reason and answers the cancelled booking with its refund flagged', async () => {
    const { booking } = await confirmedBooking();

    const res = await post(`${BOOKINGS}/${booking.id}/cancel`, { reason: 'The photographer is unwell.' });

    expect(res.status).toBe(200);
    expect(res.body).toStrictEqual({ booking: await renderedBooking(booking.id) });
    expect(res.body.booking).toMatchObject({
      status: 'cancelled_by_admin',
      lifecycle: { cancelledAt: START.toISOString(), cancellationReason: 'The photographer is unwell.' },
      money: { totals: { collectedRwf: 0, refundDueRwf: 20_000, outstandingRwf: 0 } },
    });
    expect(res.body.booking.payments[0]).toMatchObject({ status: 'refund_due', canRecordRefund: true });
  });

  it('cancels with no reason at all', async () => {
    const { booking } = await confirmedBooking();

    const res = await post(`${BOOKINGS}/${booking.id}/cancel`, {});

    expect([res.status, res.body.booking.status]).toEqual([200, 'cancelled_by_admin']);
    expect(res.body.booking.lifecycle.cancellationReason).toBeNull();
  });

  it('takes an explicit null reason', async () => {
    const { booking } = await confirmedBooking();

    const res = await post(`${BOOKINGS}/${booking.id}/cancel`, { reason: null });

    expect([res.status, res.body.booking.lifecycle.cancellationReason]).toEqual([200, null]);
  });

  it('trims the reason before storing it', async () => {
    const { booking } = await confirmedBooking();

    const res = await post(`${BOOKINGS}/${booking.id}/cancel`, { reason: '  Studio flooded.  ' });

    expect(res.body.booking.lifecycle.cancellationReason).toBe('Studio flooded.');
  });

  it('refuses a reason carrying a NUL character, which the text column cannot store', async () => {
    const { booking } = await confirmedBooking();

    const res = await post(`${BOOKINGS}/${booking.id}/cancel`, { reason: `Studio${String.fromCharCode(0)}flooded` });

    expect([res.status, res.body]).toEqual([422, { error: 'validation_failed', fields: ['reason'] }]);
    expect((await adminBooking(booking.id)).status).toBe('confirmed');
  });

  it.each([
    ['an empty reason', { reason: '' }, 422],
    ['a reason that is only whitespace', { reason: '   ' }, 422],
    ['a reason past 1000 characters', { reason: 'x'.repeat(1001) }, 422],
    ['a reason that is not a string', { reason: 42 }, 400],
    ['an unknown key', { reason: 'ok', notify: false }, 400],
  ])('refuses %s', async (_case, body, status) => {
    const { booking } = await confirmedBooking();

    const res = await post(`${BOOKINGS}/${booking.id}/cancel`, body);

    expect(res.status).toBe(status);
    expect((await adminBooking(booking.id)).status).toBe('confirmed');
  });

  it('answers 409 not_allowed with the booking when it is already cancelled', async () => {
    const { booking } = await confirmedBooking();
    await post(`${BOOKINGS}/${booking.id}/cancel`, {});

    const res = await post(`${BOOKINGS}/${booking.id}/cancel`, {});

    expect([res.status, res.body.error]).toEqual([409, 'not_allowed']);
    expect(res.body.booking).toStrictEqual(await renderedBooking(booking.id));
  });

  it('answers 404 for a booking that does not exist', async () => {
    const res = await post(`${BOOKINGS}/${UNKNOWN_ID}/cancel`, {});

    expect([res.status, res.body]).toEqual([404, { error: 'not_found' }]);
  });
});

// --- Complete and no-show -------------------------------------------------------------------

describe('POST /bookings/:id/complete and /no-show', () => {
  it.each(['complete', 'no-show'] as const)('answers 409 not_allowed before the shoot has started: %s', async (action) => {
    const { booking } = await confirmedBooking();

    const res = await post(`${BOOKINGS}/${booking.id}/${action}`, {});

    expect([res.status, res.body.error]).toEqual([409, 'not_allowed']);
    expect(res.body.booking).toMatchObject({ status: 'confirmed', actions: { canComplete: false, canMarkNoShow: false } });
  });

  it('completes once the shoot has begun and answers the completed booking', async () => {
    const { booking } = await confirmedBooking();
    await travelTo(AFTER_THE_SHOOT);

    const res = await post(`${BOOKINGS}/${booking.id}/complete`, {});

    expect(res.status).toBe(200);
    expect(res.body).toStrictEqual({ booking: await renderedBooking(booking.id) });
    expect(res.body.booking).toMatchObject({
      status: 'completed',
      lifecycle: { completedAt: AFTER_THE_SHOOT.toISOString() },
      actions: { canReschedule: false, canCancel: false, canComplete: false, canMarkNoShow: false, canResendLink: true },
    });
  });

  it('marks a no-show once the shoot has begun, owing nothing further (spec §6.12)', async () => {
    const { booking } = await confirmedBooking();
    await travelTo(AFTER_THE_SHOOT);

    const res = await post(`${BOOKINGS}/${booking.id}/no-show`, {});

    expect(res.status).toBe(200);
    expect(res.body.booking).toMatchObject({
      status: 'no_show',
      lifecycle: { completedAt: null },
      money: { totals: { collectedRwf: 20_000, outstandingRwf: 0, refundDueRwf: 0 } },
    });
    expect(res.body.booking.payments[0]).toMatchObject({ status: 'succeeded' });
  });

  it.each(['complete', 'no-show'] as const)('answers 409 not_allowed for a cancelled booking: %s', async (action) => {
    const { booking } = await confirmedBooking();
    await post(`${BOOKINGS}/${booking.id}/cancel`, {});
    await travelTo(AFTER_THE_SHOOT);

    const res = await post(`${BOOKINGS}/${booking.id}/${action}`, {});

    expect([res.status, res.body.error, res.body.booking.status]).toEqual([409, 'not_allowed', 'cancelled_by_admin']);
  });

  it.each(['complete', 'no-show'] as const)('answers 404 for a booking that does not exist: %s', async (action) => {
    const res = await post(`${BOOKINGS}/${UNKNOWN_ID}/${action}`, {});

    expect([res.status, res.body]).toEqual([404, { error: 'not_found' }]);
  });
});

// --- Resend the link ---------------------------------------------------------------------

describe('POST /bookings/:id/resend-link', () => {
  it('issues a new link and answers the booking with a fresh expiry and no last use', async () => {
    const { booking } = await confirmedBooking();
    const before = await get(`${BOOKINGS}/${booking.id}`);

    const res = await post(`${BOOKINGS}/${booking.id}/resend-link`, {});

    expect(res.status).toBe(200);
    expect(res.body).toStrictEqual({ booking: await renderedBooking(booking.id) });
    expect(res.body.booking.access).toMatchObject({ hasLink: true, lastUsedAt: null });
    expect(res.body.booking.access.expiresAt).not.toBe(before.body.booking.access.expiresAt);
  });

  it('records the message in the booking’s own history, and leaks no token through the API', async () => {
    const { booking } = await confirmedBooking();

    const res = await post(`${BOOKINGS}/${booking.id}/resend-link`, {});

    expect(res.body.booking.messages.map((message: { template: string }) => message.template)).toEqual(['access_link_resend']);
    const queued = await prisma.outbox.findFirstOrThrow({ where: { bookingId: booking.id } });
    const plaintext = (queued.payload as { accessToken: string }).accessToken;
    expect(JSON.stringify(res.body)).not.toContain(plaintext);
  });

  it('answers 409 not_allowed for a booking that was never confirmed', async () => {
    const booking = await insertBooking(prisma, world, { status: 'pending_payment', startsAt: WEDNESDAY_0900 });

    const res = await post(`${BOOKINGS}/${booking.id}/resend-link`, {});

    expect([res.status, res.body.error]).toEqual([409, 'not_allowed']);
    expect(res.body.booking).toMatchObject({ actions: { canResendLink: false } });
  });

  it('answers 404 for a booking that does not exist', async () => {
    const res = await post(`${BOOKINGS}/${UNKNOWN_ID}/resend-link`, {});

    expect([res.status, res.body]).toEqual([404, { error: 'not_found' }]);
  });
});

// --- Recording a refund --------------------------------------------------------------------

describe('POST /payments/:id/refund', () => {
  /** A cancelled booking whose booking fee is flagged for refund. */
  async function flagged() {
    const { booking, payment } = await confirmedBooking();
    await post(`${BOOKINGS}/${booking.id}/cancel`, { reason: 'Studio flooded.' });
    return { booking, payment };
  }

  it('records it and answers the booking the payment belongs to', async () => {
    const { booking, payment } = await flagged();

    const res = await post(`/api/admin/payments/${payment.id}/refund`, { reference: 'MOMO-REF-7781' });

    expect(res.status).toBe(200);
    expect(res.body).toStrictEqual({ booking: await renderedBooking(booking.id) });
    expect(res.body.booking.payments[0]).toMatchObject({
      status: 'refunded',
      refundReference: 'MOMO-REF-7781',
      refundedAt: START.toISOString(),
      canRecordRefund: false,
    });
    expect(res.body.booking.money.totals).toMatchObject({ refundDueRwf: 0, collectedRwf: 0 });
  });

  it('takes the date the photographer says he sent it', async () => {
    const { payment } = await flagged();

    const res = await post(`/api/admin/payments/${payment.id}/refund`, {
      reference: 'BANK-0001',
      refundedAt: '2026-09-28T16:30:00+02:00',
    });

    expect([res.status, res.body.booking.payments[0].refundedAt]).toEqual([200, '2026-09-28T14:30:00.000Z']);
  });

  it('answers 409 not_refundable carrying the booking, for a payment that is not flagged', async () => {
    const { booking, payment } = await confirmedBooking();

    const res = await post(`/api/admin/payments/${payment.id}/refund`, { reference: 'MOMO-REF-7781' });

    expect([res.status, res.body.error]).toEqual([409, 'not_refundable']);
    expect(res.body.booking).toStrictEqual(await renderedBooking(booking.id));
    expect(res.body.booking.payments[0]).toMatchObject({ status: 'succeeded' });
  });

  it('answers 409 not_refundable on a second recording', async () => {
    const { payment } = await flagged();
    await post(`/api/admin/payments/${payment.id}/refund`, { reference: 'MOMO-REF-7781' });

    const res = await post(`/api/admin/payments/${payment.id}/refund`, { reference: 'ANOTHER' });

    expect([res.status, res.body.error]).toEqual([409, 'not_refundable']);
    expect(res.body.booking.payments[0].refundReference).toBe('MOMO-REF-7781');
  });

  it('answers 404 for a payment that does not exist', async () => {
    const res = await post(`/api/admin/payments/${UNKNOWN_ID}/refund`, { reference: 'MOMO-REF-7781' });

    expect([res.status, res.body]).toEqual([404, { error: 'not_found' }]);
  });

  it('answers 400 for a payment id that is not a uuid', async () => {
    const res = await post('/api/admin/payments/not-a-uuid/refund', { reference: 'MOMO-REF-7781' });

    expect([res.status, res.body]).toEqual([400, { error: 'invalid_request' }]);
  });

  it.each([
    ['no reference at all', {}, 400],
    ['a reference that is not a string', { reference: 42 }, 400],
    ['an empty reference', { reference: '' }, 422],
    ['a reference of only whitespace', { reference: '   ' }, 422],
    ['a reference past 100 characters', { reference: 'x'.repeat(101) }, 422],
    ['a reference carrying a NUL character', { reference: `MOMO${String.fromCharCode(0)}1` }, 422],
    ['a refundedAt with no offset', { reference: 'MOMO-1', refundedAt: '2026-09-28T16:30:00' }, 400],
    ['an unknown key', { reference: 'MOMO-1', amountRwf: 20_000 }, 400],
  ])('refuses %s and records nothing', async (_case, body, status) => {
    const { payment } = await flagged();

    const res = await post(`/api/admin/payments/${payment.id}/refund`, body);

    expect(res.status).toBe(status);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe('refund_due');
  });
});

// --- The shape every answer shares ------------------------------------------------------------

describe('every answer is the same booking shape', () => {
  it('renders the same view from the list’s detail route and from every action', async () => {
    const { booking } = await confirmedBooking(WEDNESDAY_1400);
    const keys = Object.keys(await get(`${BOOKINGS}/${booking.id}`).then((res) => res.body.booking)).sort();

    const answers = [
      await post(`${BOOKINGS}/${booking.id}/reschedule`, { startsAt: THURSDAY_0900.toISOString() }),
      await post(`${BOOKINGS}/${booking.id}/resend-link`, {}),
      await post(`${BOOKINGS}/${booking.id}/cancel`, { reason: 'Studio flooded.' }),
      // And a refusal, which carries the booking too.
      await post(`${BOOKINGS}/${booking.id}/complete`, {}),
    ];

    for (const res of answers) {
      expect([res.status, Object.keys(res.body.booking).sort()]).toEqual([res.status, keys]);
    }
    expect(answers.map((res) => res.status)).toEqual([200, 200, 200, 409]);
  });
});
