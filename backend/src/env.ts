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
  /** Deploy configuration, never a database row (data-model_v2.md §5.2). */
  PAYMENT_PROVIDER: z.enum(['mtn_momo_direct', 'flutterwave']).default('mtn_momo_direct'),
  /** HS256 key that signs admin bearer tokens (plan.md Task 7). jose enforces no
   *  minimum key length, so this floor is the only one. Rotating it invalidates
   *  every issued token -- the only "revoke everything" there is. */
  SESSION_SECRET: z.string().min(32),
  /** Resend API key (plan.md Stack decisions). Required in production; without
   *  it in development, emails are written to MAIL_OUTPUT_DIR instead of sent. */
  RESEND_API_KEY: z.string().min(1).optional(),
  /** The sender, on a domain verified with the provider. */
  MAIL_FROM: z.string().min(3).default('Bookly <bookings@localhost>'),
  /** Where replies go, if not to MAIL_FROM. */
  MAIL_REPLY_TO: z.email().optional(),
  /** Development only: rendered emails land here when no RESEND_API_KEY is set. */
  MAIL_OUTPUT_DIR: z.string().min(1).default('.mail'),
}).refine((env) => env.NODE_ENV !== 'production' || env.RESEND_API_KEY !== undefined, {
  message: 'RESEND_API_KEY is required in production: without it no email would ever be sent',
  path: ['RESEND_API_KEY'],
});

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
