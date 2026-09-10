import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 moved the connection URL out of schema.prisma and into this file.
 * DATABASE_URL is validated properly at boot by src/env.ts; here it is read raw,
 * because the CLI runs before the app does.
 */

/** A scratch database Prisma creates and drops to replay migration history. */
function shadowUrl(): string | undefined {
  if (process.env.SHADOW_DATABASE_URL) return process.env.SHADOW_DATABASE_URL;
  if (!process.env.DATABASE_URL) return undefined;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `${url.pathname}_shadow`;
  return url.toString();
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL,
    shadowDatabaseUrl: shadowUrl(),
  },
  migrations: {
    path: 'prisma/migrations',
  },
});
