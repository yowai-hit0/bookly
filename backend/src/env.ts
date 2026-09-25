import 'dotenv/config';
import { z } from 'zod';

/** Thrown when required configuration is missing or malformed. */
export class EnvValidationError extends Error {
  override readonly name = 'EnvValidationError';

  constructor(issues: string[]) {
    super(`Invalid environment configuration:\n${issues.map((i) => `  - ${i}`).join('\n')}`);
  }
}

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(4000),
  DATABASE_URL: z.url(),
  /** Public origin the site is served from. Emails link here, never at the API host. */
  WEB_ORIGIN: z.url(),
  /** Public origin of this API. Payment providers call back on it. Defaults to
   *  localhost on PORT outside production, where no provider can reach it anyway. */
  API_ORIGIN: z.url().optional(),
  /** Deploy configuration, never a database row (data-model_v2.md §5.2). */
  PAYMENT_PROVIDER: z.enum(['mtn_momo_direct', 'flutterwave']).default('mtn_momo_direct'),
  /** MTN MoMo Collections (plan.md Task 16). Sandbox by default; production
   *  access depends on R-3. Without the three credentials, payment attempts are
   *  recorded and fail at once. */
  MTN_MOMO_BASE_URL: z.url().default('https://sandbox.momodeveloper.mtn.com'),
  MTN_MOMO_TARGET_ENVIRONMENT: z.string().min(1).default('sandbox'),
  MTN_MOMO_SUBSCRIPTION_KEY: z.string().min(1).optional(),
  MTN_MOMO_API_USER: z.string().min(1).optional(),
  MTN_MOMO_API_KEY: z.string().min(1).optional(),
  /** The sandbox accepts only EUR; defaults to EUR there and RWF elsewhere. */
  MTN_MOMO_CURRENCY: z.string().regex(/^[A-Z]{3}$/).optional(),
  /** HS256 key that signs admin bearer tokens (plan.md Task 7). jose enforces no
   *  minimum key length, so this floor is the only one. Rotating it invalidates
   *  every issued token -- the only "revoke everything" there is. */
  SESSION_SECRET: z.string().min(32),
  /** Resend API key (plan.md Stack decisions). This or BREVO_API_KEY is
   *  required in production; with neither in development, emails are written
   *  to MAIL_OUTPUT_DIR instead of sent. */
  RESEND_API_KEY: z.string().min(1).optional(),
  /** Brevo API key (`xkeysib-...`), the alternative to Resend. Set one, never both. */
  BREVO_API_KEY: z.string().min(1).optional(),
  /** The sender, on a domain verified with the provider. */
  MAIL_FROM: z.string().min(3).default('Bookly <bookings@localhost>'),
  /** Where replies go, if not to MAIL_FROM. */
  MAIL_REPLY_TO: z.email().optional(),
  /** Development only: rendered emails land here when no mail key is set. */
  MAIL_OUTPUT_DIR: z.string().min(1).default('.mail'),
}).refine((env) => env.NODE_ENV !== 'production' || env.RESEND_API_KEY !== undefined || env.BREVO_API_KEY !== undefined, {
  message: 'RESEND_API_KEY or BREVO_API_KEY is required in production: without one no email would ever be sent',
  path: ['RESEND_API_KEY'],
}).refine((env) => env.RESEND_API_KEY === undefined || env.BREVO_API_KEY === undefined, {
  message: 'set RESEND_API_KEY or BREVO_API_KEY, not both: which one sends would be a guess',
  path: ['BREVO_API_KEY'],
}).refine((env) => env.NODE_ENV !== 'production' || env.API_ORIGIN !== undefined, {
  message: 'API_ORIGIN is required in production: payment providers call back on it',
  path: ['API_ORIGIN'],
}).refine(
  (env) =>
    env.NODE_ENV !== 'production' ||
    env.PAYMENT_PROVIDER !== 'mtn_momo_direct' ||
    (env.MTN_MOMO_SUBSCRIPTION_KEY !== undefined && env.MTN_MOMO_API_USER !== undefined && env.MTN_MOMO_API_KEY !== undefined),
  {
    message: 'MTN_MOMO_SUBSCRIPTION_KEY, MTN_MOMO_API_USER and MTN_MOMO_API_KEY are required in production with PAYMENT_PROVIDER=mtn_momo_direct',
    path: ['MTN_MOMO_API_KEY'],
  },
);

export type Env = z.infer<typeof schema>;

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    throw new EnvValidationError(
      result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    );
  }
  return result.data;
}
