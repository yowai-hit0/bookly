import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CURRENCY, MoneyPrecisionError, TIME_ZONE, formatDateTime, formatMoney } from './format.js';

/** The same file the frontend suite reads. A divergence fails both projects. */
const fixture = JSON.parse(
  readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), '../../docs/fixtures/format.json'),
    'utf8',
  ),
) as {
  timeZone: string;
  currency: string;
  formatDateTime: { case: string; input: string; expected: string }[];
  formatMoney: { case: string; input: number; expected: string }[];
  formatMoneyRejects: { case: string; input: number }[];
};

describe('the shared fixture', () => {
  it('agrees with this copy of the constants', () => {
    expect(TIME_ZONE).toBe(fixture.timeZone);
    expect(CURRENCY).toBe(fixture.currency);
  });
});

describe('formatDateTime', () => {
  it.each(fixture.formatDateTime)('$case: $input', ({ input, expected }) => {
    expect(formatDateTime(input)).toBe(expected);
  });

  it('renders the same wall time regardless of the host timezone', () => {
    const original = process.env.TZ;
    process.env.TZ = 'America/New_York';
    try {
      expect(formatDateTime('2026-07-01T06:00:00Z')).toBe('1 Jul 2026, 08:00');
    } finally {
      process.env.TZ = original;
    }
  });

  it('accepts a Date as well as an ISO string', () => {
    expect(formatDateTime(new Date('2026-07-01T06:00:00Z'))).toBe('1 Jul 2026, 08:00');
  });

  it('throws on an unparseable date rather than rendering "Invalid Date"', () => {
    expect(() => formatDateTime('not a date')).toThrow(RangeError);
  });
});

describe('formatMoney', () => {
  it.each(fixture.formatMoney)('$case: $input', ({ input, expected }) => {
    expect(formatMoney(input)).toBe(expected);
  });

  it.each(fixture.formatMoneyRejects)('$case: rejects $input', ({ input }) => {
    expect(() => formatMoney(input)).toThrow(MoneyPrecisionError);
  });

  it('rejects the non-finite values JSON cannot carry in the fixture', () => {
    expect(() => formatMoney(Number.NaN)).toThrow(MoneyPrecisionError);
    expect(() => formatMoney(Number.POSITIVE_INFINITY)).toThrow(MoneyPrecisionError);
  });
});
