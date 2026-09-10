/**
 * Kigali/RWF formatting. The frontend holds its own copy of this file
 * (plan.md, Stack decisions: no shared package); both are asserted against
 * `docs/fixtures/format.json`, so a divergence fails a test in both projects.
 */

/** UTC+2, no DST (spec §6.5). Every instant is stored UTC and rendered here. */
export const TIME_ZONE = 'Africa/Kigali';

/** Prices are whole RWF integers. There is no minor unit. */
export const CURRENCY = 'RWF';

/** Thrown when an amount is not a whole number of RWF. */
export class MoneyPrecisionError extends Error {
  override readonly name = 'MoneyPrecisionError';

  constructor(amount: number) {
    super(`Money must be a whole number of ${CURRENCY}, received ${amount}`);
  }
}

const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const numberFormatter = new Intl.NumberFormat('en-GB');

/** Renders a UTC instant as Kigali wall time: `1 Jul 2026, 08:00`. */
export function formatDateTime(instant: Date | string): string {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Invalid date: ${String(instant)}`);
  }
  return dateTimeFormatter.format(date);
}

/** Renders a whole-RWF amount: `45,000 RWF`. Throws on anything else. */
export function formatMoney(amountRwf: number): string {
  if (!Number.isInteger(amountRwf)) {
    throw new MoneyPrecisionError(amountRwf);
  }
  return `${numberFormatter.format(amountRwf)} ${CURRENCY}`;
}
