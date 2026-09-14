import type { PrismaClient } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { getSettings, updateSettings } from '../settings/index.js';
import { parseOrReject } from './validation.js';

/**
 * `/api/admin/settings` -- the settings screen's API (plan.md Task 8, spec
 * P-15, P-24, P-30). Mounted behind `requireAdmin`.
 *
 * Every value is range-checked here, so a rate above 1 is a 422 and never a
 * `23514` from the database. Lower bounds are the `setting` CHECKs
 * (data-model_v2.md §5.2). The only upper bounds are the ones storage imposes:
 * the rate's `<= 1`, and `int4` for the rest, past which PostgreSQL would
 * raise 22003. No operating ceiling is invented here.
 */

const INT4_MAX = 2_147_483_647;

/** numeric(4,3) would silently round a fourth decimal place; refuse it instead. */
function hasAtMostThreeDecimals(value: number): boolean {
  const thousandths = value * 1000;
  return Math.abs(thousandths - Math.round(thousandths)) < 1e-9;
}

/** Any subset of the five values. Unknown keys are refused, so a misspelt
 *  field is a 400 rather than a save that silently changed nothing. */
const settingsBody = z.strictObject({
  bookingFeeRate: z
    .number()
    .min(0)
    .max(1)
    .refine(hasAtMostThreeDecimals, 'At most three decimal places')
    .optional(),
  minLeadTimeMinutes: z.int().min(0).max(INT4_MAX).optional(),
  holdMinutes: z.int().min(1).max(INT4_MAX).optional(),
  bufferMinutes: z.int().min(0).max(INT4_MAX).optional(),
  deliveryExpiryDays: z.int().min(1).max(INT4_MAX).optional(),
});

export function settingsRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    res.json({ settings: await getSettings(prisma) });
  });

  router.patch('/', async (req, res) => {
    const body = parseOrReject(settingsBody, req.body, res);
    if (body === undefined) return;

    res.json({ settings: await updateSettings(body, prisma) });
  });

  return router;
}
