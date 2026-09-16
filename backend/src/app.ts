import type { PrismaClient } from '@prisma/client';
import cors from 'cors';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import type { AuthDeps } from './auth/admin-auth.js';
import { adminRouter } from './routes/admin.js';
import { healthRouter } from './routes/health.js';
import { availabilityRouter } from './routes/public-availability.js';
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
   *  `/api/availability`). Omitted, they 404 too, for the same reason. `now` is
   *  the injected clock availability measures lead time against. */
  publicApi?: { prisma: PrismaClient; now?: () => Date };
};

export function createApp(options: AppOptions = {}): Express {
  const corsOrigin = options.corsOrigin ?? DEV_WEB_ORIGIN;

  const app = express();
  app.disable('x-powered-by');
  // Allowlisted to the admin UI's origin. No `credentials`: admin auth is a
  // bearer token in the Authorization header, not a cookie, so no request needs
  // the browser to attach credentials on its behalf (plan.md Task 7, rev 2.3).
  app.use(cors({ origin: [corsOrigin] }));
  app.use(express.json());

  app.use('/api', healthRouter);
  if (options.publicApi) {
    const { prisma, now = () => new Date() } = options.publicApi;
    app.use('/api', publicCatalogueRouter(prisma));
    app.use('/api/availability', availabilityRouter(prisma, now));
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
