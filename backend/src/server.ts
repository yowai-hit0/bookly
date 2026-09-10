import { createApp } from './app.js';
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

  createApp().listen(env.PORT, () => {
    console.log(`api listening on http://localhost:${env.PORT}`);
  });
}

boot();
