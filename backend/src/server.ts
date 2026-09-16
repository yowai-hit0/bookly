import { createApp } from './app.js';
import { startHoldSweeper } from './booking/hold-sweeper.js';
import { prisma } from './db/client.js';
import { EnvValidationError, parseEnv } from './env.js';

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

  const shutdown = (signal: string): void => {
    console.log(JSON.stringify({ level: 'info', event: 'shutdown', signal }));
    void holdSweeper.stop();
    server.close(() => {
      void prisma.$disconnect().then(() => process.exit(0));
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

boot();
