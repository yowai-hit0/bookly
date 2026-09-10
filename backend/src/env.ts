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
