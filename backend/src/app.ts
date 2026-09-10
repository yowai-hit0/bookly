import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { healthRouter } from './routes/health.js';

/**
 * The built frontend bundle. One deployable: Express serves these files from the
 * same origin that answers their data (spec §7), so there is no CORS middleware
 * anywhere in this app and no `Access-Control-Allow-Origin` on any response.
 */
const webDist = resolve(dirname(fileURLToPath(import.meta.url)), '../../frontend/dist');

export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());

  app.use('/api', healthRouter);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'not_found' });
  });

  if (existsSync(webDist)) {
    app.use(express.static(webDist));
    app.use((_req, res) => {
      res.sendFile(join(webDist, 'index.html'));
    });
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(JSON.stringify({ level: 'error', message: String(err) }));
    res.status(500).json({ error: 'internal_error' });
  });

  return app;
}
