import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { verifyPassword } from '../auth/password.js';
import { connect, testDatabaseUrl, truncateAll } from '../test/database.js';
import { createPrismaClient } from './client.js';
import { seedDatabase } from './seed.js';

const CREDENTIALS = { ADMIN_EMAIL: 'admin@example.com', ADMIN_PASSWORD: 'correct horse battery staple' };

let prisma: PrismaClient;
let raw: Awaited<ReturnType<typeof connect>>;

beforeAll(async () => {
  prisma = createPrismaClient(testDatabaseUrl());
  raw = connect();
  await raw.connect();
});

afterAll(async () => {
  await prisma.$disconnect();
  await raw.end();
});

beforeEach(async () => {
  await truncateAll(raw);
});

describe('seedDatabase', () => {
  it('creates 1 admin_user, 1 setting, and 5 working_hours rows', async () => {
    await seedDatabase(prisma, { ...process.env, ...CREDENTIALS });

    await expect(prisma.adminUser.count()).resolves.toBe(1);
    await expect(prisma.setting.count()).resolves.toBe(1);

    const hours = await prisma.workingHours.findMany({ orderBy: { weekday: 'asc' } });
    expect(hours).toHaveLength(5);
    expect(hours.map((row) => row.weekday)).toEqual([1, 2, 3, 4, 5]);
    for (const row of hours) {
      expect(row.opensMinute).toBe(540);
      expect(row.closesMinute).toBe(1020);
      expect(row.isOpen).toBe(true);
      expect(row.effectiveDate).toBeNull();
    }
  });

  it('is idempotent: running it twice leaves the same row counts', async () => {
    await seedDatabase(prisma, { ...process.env, ...CREDENTIALS });
    await seedDatabase(prisma, { ...process.env, ...CREDENTIALS });

    await expect(prisma.adminUser.count()).resolves.toBe(1);
    await expect(prisma.setting.count()).resolves.toBe(1);
    await expect(prisma.workingHours.count()).resolves.toBe(5);
  });

  it('stores the admin password hashed, not plain', async () => {
    await seedDatabase(prisma, { ...process.env, ...CREDENTIALS });

    const admin = await prisma.adminUser.findFirstOrThrow();
    expect(admin.passwordHash).not.toBe(CREDENTIALS.ADMIN_PASSWORD);
    expect(admin.passwordHash).toMatch(/^\$argon2id\$/);
    await expect(verifyPassword(admin.passwordHash, CREDENTIALS.ADMIN_PASSWORD)).resolves.toBe(true);
  });

  it('requires ADMIN_EMAIL and ADMIN_PASSWORD only when no admin exists yet', async () => {
    await expect(seedDatabase(prisma, {})).rejects.toThrow();

    await seedDatabase(prisma, { ...process.env, ...CREDENTIALS });
    // A reseed of an already-seeded database needs no credentials at all.
    await expect(seedDatabase(prisma, {})).resolves.toMatchObject({ adminUserCreated: false });
  });
});
