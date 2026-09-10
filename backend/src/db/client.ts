import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { parseEnv } from '../env.js';

/**
 * Prisma 7 takes its connection through a driver adapter rather than a URL in
 * schema.prisma, so the URL is validated by env.ts before it is ever used.
 *
 * The client speaks only to the tables. Every guarantee that protects the
 * business -- the exclusion constraint, the four partial unique indexes, every
 * CHECK -- lives in migration SQL that Prisma cannot see and cannot report on
 * (data-model_v2.md 2.1). Losing one of them is caught by the schema test, not
 * by this client.
 */
export function createPrismaClient(databaseUrl = parseEnv().DATABASE_URL): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
}

export const prisma = createPrismaClient();
