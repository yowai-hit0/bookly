import type { PrismaClient } from '@prisma/client';
import cors from 'cors';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import type { AuthDeps } from './auth/admin-auth.js';
import type { PaymentProvider } from './payments/provider.js';
import { adminRouter } from './routes/admin.js';
import { healthRouter } from './routes/health.js';
import { clientBookingRouter } from './routes/client-booking.js';
import { type PaymentWebhooksDeps, paymentWebhooksRouter } from './routes/payment-webhooks.js';
import { availabilityRouter } from './routes/public-availability.js';
import { bookingsRouter } from './routes/public-bookings.js';
import { checkoutRouter } from './routes/public-checkout.js';
import { publicCatalogueRouter } from './routes/public-catalogue.js';

// Dev/test default, kept in sync with vite.config.ts's port and .env.example's
// WEB_ORIGIN. server.ts always overrides this with env.WEB_ORIGIN once parsed.
const DEV_WEB_ORIGIN = 'http://localhost:5173';

export type AppOptions = {
  corsOrigin?: string;
  /** Mounts `/api/admin/*`. Omitted, those paths 404 -- closed, not open --
   *  which keeps the health checks free of a database. */
  admin?: AuthDeps;
  /** Mounts the anonymous public routes (`/api/services`, `/api/quote`,
   *  `/api/availability`, `/api/bookings`). Omitted, they 404 too, for the same
   *  reason. `now` is the injected clock lead time and consent are measured by. */
  publicApi?: {
    prisma: PrismaClient;
    now?: () => Date;
    /** Mounts the checkout (`/api/payment-methods`, `/api/checkout/*`,
     *  `/api/payments/*`) and puts a checkout token on each created booking
     *  (plan.md Task 16). `secret` is `SESSION_SECRET`. */
    payments?: { provider: PaymentProvider; secret: string; providerTimeoutMs?: number };
  };
  /** Mounts `/api/webhooks/*` (plan.md Task 17), ahead of the JSON parser. */
  webhooks?: PaymentWebhooksDeps;
};

export function createApp(options: AppOptions = {}): Express {
  const corsOrigin = options.corsOrigin ?? DEV_WEB_ORIGIN;

  const app = express();
  app.disable('x-powered-by');
  // Allowlisted to the admin UI's origin. No `credentials`: admin auth is a
  // bearer token in the Authorization header, not a cookie, so no request needs
  // the browser to attach credentials on its behalf (plan.md Task 7, rev 2.3).
  app.use(cors({ origin: [corsOrigin] }));
  // Before the JSON parser, which would otherwise consume a callback's body
  // before its signature could be checked against the bytes (plan.md Task 17).
  if (options.webhooks) app.use('/api/webhooks', paymentWebhooksRouter(options.webhooks));
  app.use(express.json());

  app.use('/api', healthRouter);
  if (options.publicApi) {
    const { prisma, now = () => new Date() } = options.publicApi;
    app.use('/api', publicCatalogueRouter(prisma));
    app.use('/api/availability', availabilityRouter(prisma, now));
    app.use('/api/bookings', bookingsRouter(prisma, now, options.publicApi.payments?.secret));
    if (options.publicApi.payments) {
      app.use('/api', checkoutRouter({ prisma, ...options.publicApi.payments }));
    }
    // The client's own booking, addressed by its access token (plan.md Task 18).
    const clientPayments = options.publicApi.payments;
    app.use(
      '/api/booking',
      clientBookingRouter({
        prisma,
        now,
        ...(clientPayments === undefined
          ? {}
          : {
              payments: {
                provider: clientPayments.provider,
                ...(clientPayments.providerTimeoutMs === undefined ? {} : { providerTimeoutMs: clientPayments.providerTimeoutMs }),
              },
            }),
      }),
    );
  }
  if (options.admin) app.use('/api/admin', adminRouter(options.admin));

  app.use((_req, res) => {
    res.status(404).json({ error: 'not_found' });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    // Body-parser marks a malformed or oversized body as a client error it is
    // safe to expose, and the router answers a path parameter it cannot
    // percent-decode (`/api/services/%E0%A4%A`) the same way. Either is a 4xx,
    // not a 500 -- and neither echoes the body or the path.
    if (isExposedClientError(err) || isUndecodableParam(err)) {
      res.status(err.status).json({ error: 'invalid_request' });
      return;
    }
    console.error(JSON.stringify({ level: 'error', message: String(err) }));
    res.status(500).json({ error: 'internal_error' });
  });

  return app;
}

function isExposedClientError(err: unknown): err is { status: number } {
  if (typeof err !== 'object' || err === null) return false;
  const { status, expose } = err as { status?: unknown; expose?: unknown };
  return expose === true && typeof status === 'number' && status >= 400 && status < 500;
}

/** The router's `decodeURIComponent` failure: a URIError it sets to 400 but never marks `expose`. */
function isUndecodableParam(err: unknown): err is URIError & { status: 400 } {
  return err instanceof URIError && (err as { status?: unknown }).status === 400;
}
