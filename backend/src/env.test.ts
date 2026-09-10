import { describe, expect, it } from 'vitest';
import { EnvValidationError, parseEnv } from './env.js';

const valid = {
  DATABASE_URL: 'postgresql://bookly:bookly@localhost:5432/bookly',
  WEB_ORIGIN: 'http://localhost:5173',
};

describe('parseEnv', () => {
  it('applies defaults for the optional variables', () => {
    const env = parseEnv(valid);
    expect(env.PORT).toBe(4000);
    expect(env.NODE_ENV).toBe('development');
    expect(env.PAYMENT_PROVIDER).toBe('mtn_momo_direct');
  });

  it('throws a named error when DATABASE_URL is missing', () => {
    const { DATABASE_URL: _omitted, ...withoutDatabaseUrl } = valid;
    expect(() => parseEnv(withoutDatabaseUrl)).toThrow(EnvValidationError);
    expect(() => parseEnv(withoutDatabaseUrl)).toThrow(/DATABASE_URL/);
  });

  it('rejects an unknown payment provider', () => {
    expect(() => parseEnv({ ...valid, PAYMENT_PROVIDER: 'stripe' })).toThrow(EnvValidationError);
  });
});
