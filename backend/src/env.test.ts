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
    // Production also needs the payment settings added in plan.md Task 16.
    const payments = { API_ORIGIN: 'https://api.bookly.example', MTN_MOMO_SUBSCRIPTION_KEY: 'k', MTN_MOMO_API_USER: 'u', MTN_MOMO_API_KEY: 'a' };
    expect(parseEnv({ ...valid, ...payments, NODE_ENV: 'production', RESEND_API_KEY: 're_live_key' }).RESEND_API_KEY).toBe('re_live_key');
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

describe('parseEnv: payments (plan.md Tasks 16 and 17)', () => {
  const production = {
    ...valid,
    NODE_ENV: 'production',
    RESEND_API_KEY: 're_live_key',
    API_ORIGIN: 'https://api.bookly.example',
    MTN_MOMO_SUBSCRIPTION_KEY: 'sub',
    MTN_MOMO_API_USER: 'user',
    MTN_MOMO_API_KEY: 'key',
  };

  it('defaults to the MTN sandbox, with no origin, credentials or currency set', () => {
    const env = parseEnv(valid);
    expect(env).toMatchObject({
      PAYMENT_PROVIDER: 'mtn_momo_direct',
      MTN_MOMO_BASE_URL: 'https://sandbox.momodeveloper.mtn.com',
      MTN_MOMO_TARGET_ENVIRONMENT: 'sandbox',
    });
    for (const key of ['API_ORIGIN', 'MTN_MOMO_SUBSCRIPTION_KEY', 'MTN_MOMO_API_USER', 'MTN_MOMO_API_KEY', 'MTN_MOMO_CURRENCY'] as const) {
      expect(env[key]).toBeUndefined();
    }
  });

  it('reads every payment variable when set', () => {
    const env = parseEnv({
      ...valid,
      API_ORIGIN: 'https://api.bookly.example',
      MTN_MOMO_BASE_URL: 'https://proxy.momoapi.mtn.co.rw',
      MTN_MOMO_TARGET_ENVIRONMENT: 'mtnrwanda',
      MTN_MOMO_SUBSCRIPTION_KEY: 'sub',
      MTN_MOMO_API_USER: 'user',
      MTN_MOMO_API_KEY: 'key',
      MTN_MOMO_CURRENCY: 'RWF',
    });
    expect(env).toMatchObject({
      API_ORIGIN: 'https://api.bookly.example',
      MTN_MOMO_BASE_URL: 'https://proxy.momoapi.mtn.co.rw',
      MTN_MOMO_TARGET_ENVIRONMENT: 'mtnrwanda',
      MTN_MOMO_SUBSCRIPTION_KEY: 'sub',
      MTN_MOMO_API_USER: 'user',
      MTN_MOMO_API_KEY: 'key',
      MTN_MOMO_CURRENCY: 'RWF',
    });
  });

  it.each(['development', 'test'])('needs neither API_ORIGIN nor MTN credentials in %s', (NODE_ENV) => {
    expect(() => parseEnv({ ...valid, NODE_ENV })).not.toThrow();
  });

  it('accepts a complete production configuration', () => {
    expect(parseEnv(production).API_ORIGIN).toBe('https://api.bookly.example');
  });

  it('requires API_ORIGIN in production, naming it', () => {
    const { API_ORIGIN: _omitted, ...withoutOrigin } = production;
    expect(() => parseEnv(withoutOrigin)).toThrow(EnvValidationError);
    expect(() => parseEnv(withoutOrigin)).toThrow(/API_ORIGIN/);
  });

  it.each(['MTN_MOMO_SUBSCRIPTION_KEY', 'MTN_MOMO_API_USER', 'MTN_MOMO_API_KEY'] as const)(
    'requires %s in production while MTN direct takes payments, naming the credentials',
    (key) => {
      const without: Record<string, string> = { ...production };
      delete without[key];
      expect(() => parseEnv(without)).toThrow(EnvValidationError);
      expect(() => parseEnv(without)).toThrow(/MTN_MOMO_SUBSCRIPTION_KEY, MTN_MOMO_API_USER and MTN_MOMO_API_KEY are required/);
    },
  );

  it('does not require MTN credentials in production once Flutterwave takes payments', () => {
    const { MTN_MOMO_SUBSCRIPTION_KEY: _s, MTN_MOMO_API_USER: _u, MTN_MOMO_API_KEY: _k, ...withoutMtn } = production;
    expect(parseEnv({ ...withoutMtn, PAYMENT_PROVIDER: 'flutterwave' }).PAYMENT_PROVIDER).toBe('flutterwave');
  });

  it('names every missing production setting at once', () => {
    const { API_ORIGIN: _o, MTN_MOMO_API_KEY: _k, RESEND_API_KEY: _r, ...bare } = production;
    let message = '';
    try {
      parseEnv(bare);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/RESEND_API_KEY/);
    expect(message).toMatch(/API_ORIGIN/);
    expect(message).toMatch(/MTN_MOMO_API_KEY/);
  });

  it.each(['not a url', 'api.bookly.example', ''])('rejects an API_ORIGIN of "%s", naming it', (API_ORIGIN) => {
    expect(() => parseEnv({ ...valid, API_ORIGIN })).toThrow(/API_ORIGIN/);
  });

  it.each(['not a url', ''])('rejects an MTN_MOMO_BASE_URL of "%s", naming it', (MTN_MOMO_BASE_URL) => {
    expect(() => parseEnv({ ...valid, MTN_MOMO_BASE_URL })).toThrow(/MTN_MOMO_BASE_URL/);
  });

  it.each(['eur', 'EURO', 'EU', '978', ''])('rejects an MTN_MOMO_CURRENCY of "%s", naming it', (MTN_MOMO_CURRENCY) => {
    expect(() => parseEnv({ ...valid, MTN_MOMO_CURRENCY })).toThrow(/MTN_MOMO_CURRENCY/);
  });

  it.each(['MTN_MOMO_SUBSCRIPTION_KEY', 'MTN_MOMO_API_USER', 'MTN_MOMO_API_KEY', 'MTN_MOMO_TARGET_ENVIRONMENT'])('rejects an empty %s, naming it', (key) => {
    expect(() => parseEnv({ ...valid, [key]: '' })).toThrow(new RegExp(key));
  });
});
