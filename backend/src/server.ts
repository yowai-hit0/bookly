import { createApp } from './app.js';
import { startHoldSweeper } from './booking/hold-sweeper.js';
import { prisma } from './db/client.js';
import { createEmailHandler } from './email/handler.js';
import { createMailProvider } from './email/mailer.js';
import { EnvValidationError, parseEnv } from './env.js';
import { startOutboxWorker } from './outbox/worker.js';

function boot(): void {
  let env;
  try {
    env = parseEnv();
  } catch (err) {
    if (err instanceof EnvValidationError) {
      console.error(err.message);
      process.exit(1);
    }
    throw err;
  }

  const app = createApp({
    corsOrigin: env.WEB_ORIGIN,
    admin: {
      prisma,
      sessionSecret: env.SESSION_SECRET,
      webOrigin: env.WEB_ORIGIN,
      now: () => new Date(),
    },
    publicApi: { prisma, now: () => new Date() },
  });

  const server = app.listen(env.PORT, () => {
    console.log(`api listening on http://localhost:${env.PORT}`);
  });

  // One instance, one loop (plan.md, Stack decisions). The sweeper is tidiness
  // rather than correctness -- the claim transaction expires the stale holds
  // that block it (data-model_v2.md §9.2) -- so nothing here is load-bearing.
  const holdSweeper = startHoldSweeper(prisma);

  // Everything the system sends goes through the outbox (plan.md Task 14).
  // Calendar kinds get their handler with Task 22; until then they wait.
  const outboxWorker = startOutboxWorker({
    prisma,
    handlers: { email: createEmailHandler({ mail: createMailProvider(env), webOrigin: env.WEB_ORIGIN }) },
  });

  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(JSON.stringify({ level: 'info', event: 'shutdown', signal }));
    void holdSweeper.stop();
    server.close(() => {
      // The worker finishes the message in hand before the connection goes, so
      // no row is left claimed in `processing` (plan.md Task 14).
      void outboxWorker
        .stop()
        .then(() => prisma.$disconnect())
        .then(() => process.exit(0));
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

boot();
