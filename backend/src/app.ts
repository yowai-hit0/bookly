import cors from 'cors';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { healthRouter } from './routes/health.js';

// Dev/test default, kept in sync with vite.config.ts's port and .env.example's
// WEB_ORIGIN. server.ts always overrides this with env.WEB_ORIGIN once parsed.
const DEV_WEB_ORIGIN = 'http://localhost:5173';

export function createApp(options: { corsOrigin?: string } = {}): Express {
  const corsOrigin = options.corsOrigin ?? DEV_WEB_ORIGIN;

  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: [corsOrigin], credentials: true }));
  app.use(express.json());

  app.use('/api', healthRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: 'not_found' });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(JSON.stringify({ level: 'error', message: String(err) }));
    res.status(500).json({ error: 'internal_error' });
  });

  return app;
}
