import type { Env } from '../env.js';
import { MtnMomoProvider } from './mtn-momo.js';
import type { PaymentProvider, PaymentProviderId } from './provider.js';

/**
 * The providers for this deployment (spec §4.3, §6.18): every one whose
 * callbacks must still be accepted, and the one `PAYMENT_PROVIDER` names for
 * new payments. MTN stays constructed after a cutover so its in-flight payments
 * still settle.
 */
export type PaymentProviders = {
  active: PaymentProvider;
  all: Partial<Record<PaymentProviderId, PaymentProvider>>;
};

export function createPaymentProviders(
  env: Pick<
    Env,
    | 'NODE_ENV'
    | 'PORT'
    | 'API_ORIGIN'
    | 'SESSION_SECRET'
    | 'PAYMENT_PROVIDER'
    | 'MTN_MOMO_BASE_URL'
    | 'MTN_MOMO_TARGET_ENVIRONMENT'
    | 'MTN_MOMO_SUBSCRIPTION_KEY'
    | 'MTN_MOMO_API_USER'
    | 'MTN_MOMO_API_KEY'
    | 'MTN_MOMO_CURRENCY'
  >,
): PaymentProviders {
  const mtn = new MtnMomoProvider({
    baseUrl: env.MTN_MOMO_BASE_URL,
    targetEnvironment: env.MTN_MOMO_TARGET_ENVIRONMENT,
    currency: env.MTN_MOMO_CURRENCY ?? (env.MTN_MOMO_TARGET_ENVIRONMENT === 'sandbox' ? 'EUR' : 'RWF'),
    subscriptionKey: env.MTN_MOMO_SUBSCRIPTION_KEY,
    apiUser: env.MTN_MOMO_API_USER,
    apiKey: env.MTN_MOMO_API_KEY,
    callbackOrigin: env.API_ORIGIN ?? `http://localhost:${env.PORT}`,
    secret: env.SESSION_SECRET,
  });

  if (env.PAYMENT_PROVIDER === 'flutterwave') {
    throw new Error('PAYMENT_PROVIDER=flutterwave is not implemented yet (plan.md Task 25)');
  }
  return { active: mtn, all: { mtn_momo_direct: mtn } };
}
