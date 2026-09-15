import type { Prisma, PrismaClient } from '@prisma/client';
import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createPrismaClient } from '../db/client.js';
import { connect, testDatabaseUrl, truncateAll } from '../test/database.js';
import { listPublicCatalogue } from './public.js';

/**
 * `listPublicCatalogue()` against real PostgreSQL (plan.md Task 10; spec §3.4,
 * §6.14). It is "the public list" Task 11's route serves: active services,
 * each with its active packages, then its own active add-ons followed by the
 * active add-ons offered on every service -- and nothing the public must not
 * see.
 */

let prisma: PrismaClient;
let raw: pg.Client;

beforeAll(async () => {
  prisma = createPrismaClient(testDatabaseUrl());
  raw = connect();
  await raw.connect();
});

afterAll(async () => {
  await truncateAll(raw);
  await prisma.$disconnect();
  await raw.end();
});

beforeEach(async () => {
  await truncateAll(raw);
});

// --- Fixtures ---------------------------------------------------------------

function insertService(slug: string, data: Partial<Prisma.ServiceUncheckedCreateInput> = {}) {
  return prisma.service.create({ data: { slug, nameEn: slug, ...data } });
}

function insertPackage(serviceId: string, nameEn: string, data: Partial<Prisma.PackageUncheckedCreateInput> = {}) {
  return prisma.package.create({
    data: { serviceId, nameEn, priceRwf: 40_000, photoCount: 20, durationMinutes: 60, ...data },
  });
}

function insertAddon(serviceId: string | null, nameEn: string, data: Partial<Prisma.AddonUncheckedCreateInput> = {}) {
  return prisma.addon.create({ data: { serviceId, nameEn, priceRwf: 10_000, ...data } });
}

type Listed = Awaited<ReturnType<typeof listPublicCatalogue>>;

/** Each service's slug with its package and add-on names, for order-only assertions. */
function names(list: Listed) {
  return list.map((service) => ({
    slug: service.slug,
    packages: service.packages.map((pkg) => pkg.nameEn),
    addons: service.addons.map((addon) => addon.nameEn),
  }));
}

// --- Filtering -----------------------------------------------------------------

describe('listPublicCatalogue', () => {
  it('lists nothing for an empty catalogue', async () => {
    await expect(listPublicCatalogue(prisma)).resolves.toEqual([]);
  });

  it('lists only active services, each with only its active packages and active add-ons', async () => {
    const portraits = await insertService('portraits', {
      nameEn: 'Portraits',
      descriptionEn: 'Studio portraits.',
      coverImageUrl: 'https://images.example.com/portraits.jpg',
    });
    const standard = await insertPackage(portraits.id, 'Standard', { descriptionEn: 'One look.', priceRwf: 45_000, photoCount: 25, durationMinutes: 90 });
    await insertPackage(portraits.id, 'Retired', { isActive: false });
    const extraHour = await insertAddon(portraits.id, 'Extra hour', { priceRwf: 15_000 });
    await insertAddon(portraits.id, 'Old frame', { isActive: false });

    // An inactive service hides its active packages and add-ons with it.
    const events = await insertService('events', { isActive: false });
    await insertPackage(events.id, 'Half day');
    await insertAddon(events.id, 'Drone');

    const rush = await insertAddon(null, 'Rush edit', { priceRwf: 5_000 });
    await insertAddon(null, 'Discontinued prints', { isActive: false });

    await expect(listPublicCatalogue(prisma)).resolves.toEqual([
      {
        id: portraits.id,
        slug: 'portraits',
        nameEn: 'Portraits',
        descriptionEn: 'Studio portraits.',
        coverImageUrl: 'https://images.example.com/portraits.jpg',
        packages: [
          {
            id: standard.id,
            nameEn: 'Standard',
            descriptionEn: 'One look.',
            priceRwf: 45_000,
            photoCount: 25,
            durationMinutes: 90,
          },
        ],
        addons: [
          { id: extraHour.id, nameEn: 'Extra hour', priceRwf: 15_000 },
          { id: rush.id, nameEn: 'Rush edit', priceRwf: 5_000 },
        ],
      },
    ]);
  });

  it('offers the shared add-ons on every active service, after each service’s own and never another service’s', async () => {
    const weddings = await insertService('weddings');
    await insertService('products');
    await insertAddon(weddings.id, 'Second shooter', { sortOrder: 1 });
    await insertAddon(weddings.id, 'Album', { sortOrder: 0 });
    // Sort order 0 here, yet still after a service's own add-on of order 1.
    await insertAddon(null, 'Rush edit', { sortOrder: 5 });
    await insertAddon(null, 'Prints', { sortOrder: 0 });

    expect(names(await listPublicCatalogue(prisma))).toEqual([
      { slug: 'products', packages: [], addons: ['Prints', 'Rush edit'] },
      { slug: 'weddings', packages: [], addons: ['Album', 'Second shooter', 'Prints', 'Rush edit'] },
    ]);
  });

  it('orders services, packages and add-ons by display order, then name, then age', async () => {
    const older = new Date('2026-09-01T00:00:00Z');
    const newer = new Date('2026-09-02T00:00:00Z');
    // Inserted out of order, so insertion order cannot pass for sorting.
    const zulu = await insertService('zulu', { nameEn: 'Zulu', sortOrder: 1 });
    await insertService('mike-newer', { nameEn: 'Mike', sortOrder: 1, createdAt: newer });
    await insertService('alpha', { nameEn: 'Alpha', sortOrder: 2 });
    await insertService('mike-older', { nameEn: 'Mike', sortOrder: 1, createdAt: older });

    await insertPackage(zulu.id, 'Beta', { sortOrder: 1 });
    await insertPackage(zulu.id, 'Gamma', { sortOrder: 0, createdAt: newer, priceRwf: 2 });
    await insertPackage(zulu.id, 'Alpha', { sortOrder: 1 });
    await insertPackage(zulu.id, 'Gamma', { sortOrder: 0, createdAt: older, priceRwf: 1 });

    await insertAddon(zulu.id, 'Zoom', { sortOrder: 0 });
    await insertAddon(zulu.id, 'Album', { sortOrder: 3 });
    await insertAddon(null, 'Retouch', { sortOrder: 1 });
    await insertAddon(null, 'Drone', { sortOrder: 1 });

    const list = await listPublicCatalogue(prisma);

    expect(list.map((service) => service.slug)).toEqual(['mike-older', 'mike-newer', 'zulu', 'alpha']);
    const zuluListed = list.find((service) => service.id === zulu.id);
    expect(zuluListed?.packages.map((pkg) => [pkg.nameEn, pkg.priceRwf])).toEqual([
      ['Gamma', 1],
      ['Gamma', 2],
      ['Alpha', 40_000],
      ['Beta', 40_000],
    ]);
    expect(zuluListed?.addons.map((addon) => addon.nameEn)).toEqual(['Zoom', 'Album', 'Drone', 'Retouch']);
  });

  it('projects an allowlist: no status, sort key, French, fee override, service id or timestamps', async () => {
    const service = await insertService('portraits', {
      nameEn: 'Portraits',
      nameFr: 'Portraits FR',
      descriptionEn: 'Studio portraits.',
      descriptionFr: 'Portraits en studio.',
      coverImageUrl: 'https://images.example.com/portraits.jpg',
      bookingFeeRateOverride: '0.300',
      sortOrder: 4,
    });
    await insertPackage(service.id, 'Standard', { nameFr: 'Standard FR', descriptionFr: 'Un look.', sortOrder: 2 });
    await insertAddon(service.id, 'Extra hour', { nameFr: 'Heure en plus', sortOrder: 3 });
    await insertAddon(null, 'Rush edit', { nameFr: 'Retouche express' });

    const [listed] = await listPublicCatalogue(prisma);

    expect(Object.keys(listed ?? {}).sort()).toEqual(['addons', 'coverImageUrl', 'descriptionEn', 'id', 'nameEn', 'packages', 'slug']);
    expect(listed?.packages.map((pkg) => Object.keys(pkg).sort())).toEqual([
      ['descriptionEn', 'durationMinutes', 'id', 'nameEn', 'photoCount', 'priceRwf'],
    ]);
    expect(listed?.addons.map((addon) => Object.keys(addon).sort())).toEqual([
      ['id', 'nameEn', 'priceRwf'],
      ['id', 'nameEn', 'priceRwf'],
    ]);
    const json = JSON.stringify(listed);
    for (const hidden of ['FR', 'Un look.', 'Heure en plus', 'Retouche express', 'en studio', '0.3', 'isActive', 'sortOrder', 'serviceId', 'createdAt']) {
      expect(json).not.toContain(hidden);
    }
  });
});

// --- Spec §6.14 -------------------------------------------------------------------

describe('a deactivated service with bookings (spec §6.14)', () => {
  it('leaves the public list while its bookings stay readable with their snapshots', async () => {
    const service = await insertService('portraits', { nameEn: 'Portraits' });
    const pkg = await insertPackage(service.id, 'Standard');
    const addon = await insertAddon(service.id, 'Extra hour', { priceRwf: 15_000 });
    const client = await prisma.client.create({
      data: { fullName: 'Aline Uwase', email: 'aline@example.com', phone: '+250788000000' },
    });
    const startsAt = new Date('2026-10-07T07:00:00Z');
    const booking = await prisma.booking.create({
      data: {
        reference: 'BKY-2610-00001',
        clientId: client.id,
        contactName: 'Aline Uwase',
        contactEmail: 'aline@example.com',
        contactPhone: '+250788000000',
        serviceId: service.id,
        packageId: pkg.id,
        serviceNameSnapshot: 'Portraits',
        packageNameSnapshot: 'Standard',
        packagePriceRwf: 40_000,
        packageDurationMinutes: 60,
        packagePhotoCount: 20,
        locationText: 'Kigali Heights',
        consentAt: new Date('2026-10-01T06:00:00Z'),
        bookingFeeRate: '0.400',
        bookingFeeRwf: 22_000,
        status: 'confirmed',
        startsAt,
        endsAt: new Date('2026-10-07T08:00:00Z'),
        bufferEndsAt: new Date('2026-10-07T08:30:00Z'),
        addons: {
          create: {
            addonId: addon.id,
            nameSnapshot: 'Extra hour',
            unitPriceRwf: 15_000,
            quantity: 1,
            amountRwf: 15_000,
            stage: 'at_booking',
          },
        },
      },
    });
    expect(names(await listPublicCatalogue(prisma))).toEqual([
      { slug: 'portraits', packages: ['Standard'], addons: ['Extra hour'] },
    ]);

    await prisma.service.update({ where: { id: service.id }, data: { isActive: false, nameEn: 'Portrait sessions' } });
    await prisma.package.update({ where: { id: pkg.id }, data: { isActive: false, priceRwf: 99_000 } });
    await prisma.addon.update({ where: { id: addon.id }, data: { isActive: false, priceRwf: 99_000 } });

    await expect(listPublicCatalogue(prisma)).resolves.toEqual([]);
    const readable = await prisma.booking.findUniqueOrThrow({
      where: { id: booking.id },
      include: { service: true, package: true, addons: true },
    });
    expect(readable).toMatchObject({
      status: 'confirmed',
      serviceNameSnapshot: 'Portraits',
      packageNameSnapshot: 'Standard',
      packagePriceRwf: 40_000,
      packageDurationMinutes: 60,
      packagePhotoCount: 20,
      bookingFeeRwf: 22_000,
      startsAt,
      service: { id: service.id, isActive: false },
      package: { id: pkg.id, isActive: false },
      addons: [{ addonId: addon.id, nameSnapshot: 'Extra hour', unitPriceRwf: 15_000, amountRwf: 15_000 }],
    });
    expect(readable.bookingFeeRate.toFixed(3)).toBe('0.400');
  });
});
