import type { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../db/client.js';
import { readSettingRow } from './repository.js';

/**
 * The five editable operating values (spec P-30), plus the two constants that
 * have no settings screen behind them. Nothing here is ever a `Decimal` --
 * `bookingFeeRate` is converted at this boundary so no caller handles one
 * (data-model_v2.md §2.1).
 */
export type Settings = {
  bookingFeeRate: number;
  minLeadTimeMinutes: number;
  holdMinutes: number;
  bufferMinutes: number;
  deliveryExpiryDays: number;
};

// Re-exported so callers have one settings entrypoint. They are defined in a
// module that imports nothing, so the availability engine can read the slot
// granularity without dragging a PrismaClient in behind it (plan.md Task 5).
export { ACCESS_TOKEN_LIFETIME_DAYS, SLOT_GRANULARITY_MINUTES } from './constants.js';

/** The single accessor for the five operating values (plan.md Task 4). */
export async function getSettings(prisma: PrismaClient = defaultPrisma): Promise<Settings> {
  const row = await readSettingRow(prisma);
  return {
    bookingFeeRate: row.bookingFeeRate.toNumber(),
    minLeadTimeMinutes: row.minLeadTimeMinutes,
    holdMinutes: row.holdMinutes,
    bufferMinutes: row.bufferMinutes,
    deliveryExpiryDays: row.deliveryExpiryDays,
  };
}
