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

describe('parseEnv: email (plan.md Task 15)', () => {
  it('defaults the sender and the development mail folder, and leaves the key and reply-to unset', () => {
    const env = parseEnv(valid);
    expect(env.MAIL_FROM).toBe('Bookly <bookings@localhost>');
    expect(env.MAIL_OUTPUT_DIR).toBe('.mail');
    expect(env.RESEND_API_KEY).toBeUndefined();
    expect(env.MAIL_REPLY_TO).toBeUndefined();
  });

  it.each(['development', 'test'])('does not require RESEND_API_KEY in %s', (NODE_ENV) => {
    expect(parseEnv({ ...valid, NODE_ENV }).RESEND_API_KEY).toBeUndefined();
  });

  it('requires RESEND_API_KEY in production, naming it', () => {
    expect(() => parseEnv({ ...valid, NODE_ENV: 'production' })).toThrow(EnvValidationError);
    expect(() => parseEnv({ ...valid, NODE_ENV: 'production' })).toThrow(/RESEND_API_KEY/);
    expect(() => parseEnv({ ...valid, NODE_ENV: 'production', RESEND_API_KEY: '' })).toThrow(/RESEND_API_KEY/);
    expect(parseEnv({ ...valid, NODE_ENV: 'production', RESEND_API_KEY: 're_live_key' }).RESEND_API_KEY).toBe('re_live_key');
  });

  it('reads the configured sender, reply-to and folder', () => {
    const env = parseEnv({
      ...valid,
      MAIL_FROM: 'Bookly Studio <hello@bookly.example>',
      MAIL_REPLY_TO: 'photographer@bookly.example',
      MAIL_OUTPUT_DIR: 'tmp/mail',
    });
    expect(env).toMatchObject({
      MAIL_FROM: 'Bookly Studio <hello@bookly.example>',
      MAIL_REPLY_TO: 'photographer@bookly.example',
      MAIL_OUTPUT_DIR: 'tmp/mail',
    });
  });

  it('rejects a MAIL_REPLY_TO that is not an address, naming it', () => {
    expect(() => parseEnv({ ...valid, MAIL_REPLY_TO: 'not an address' })).toThrow(/MAIL_REPLY_TO/);
  });
});
