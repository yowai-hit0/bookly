import { describe, expect, it } from 'vitest';
import { EnvValidationError, parseEnv } from './env.js';

const valid = {
  DATABASE_URL: 'postgresql://bookly:bookly@localhost:5432/bookly',
  WEB_ORIGIN: 'http://localhost:5173',
  SESSION_SECRET: 'a-test-secret-that-is-at-least-32-chars-long',
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

  it('throws a named error when SESSION_SECRET is missing', () => {
    const { SESSION_SECRET: _omitted, ...withoutSecret } = valid;
    expect(() => parseEnv(withoutSecret)).toThrow(EnvValidationError);
    expect(() => parseEnv(withoutSecret)).toThrow(/SESSION_SECRET/);
  });

  it('rejects a SESSION_SECRET shorter than 32 characters', () => {
    expect(() => parseEnv({ ...valid, SESSION_SECRET: 'x'.repeat(31) })).toThrow(/SESSION_SECRET/);
    expect(parseEnv({ ...valid, SESSION_SECRET: 'x'.repeat(32) }).SESSION_SECRET).toHaveLength(32);
  });

  it('rejects an unknown payment provider', () => {
    expect(() => parseEnv({ ...valid, PAYMENT_PROVIDER: 'stripe' })).toThrow(EnvValidationError);
  });
});
