import type { PrismaClient } from '@prisma/client';

/**
 * What the public site may list (plan.md Task 10; Task 11 serves it): active
 * services, each with its active packages and the active add-ons it offers --
 * its own, then those offered on every service (`service_id` null).
 *
 * An allowlist projection. Inactive rows, sort keys, French columns and the
 * fee-rate override are left out; Task 11 adds what its pages need.
 */

export type PublicPackage = {
  id: string;
  nameEn: string;
  descriptionEn: string | null;
  priceRwf: number;
  photoCount: number;
  durationMinutes: number;
};

export type PublicAddon = {
  id: string;
  nameEn: string;
  priceRwf: number;
};

export type PublicService = {
  id: string;
  slug: string;
  nameEn: string;
  descriptionEn: string | null;
  coverImageUrl: string | null;
  packages: PublicPackage[];
  addons: PublicAddon[];
};

const ORDER = [{ sortOrder: 'asc' }, { nameEn: 'asc' }, { createdAt: 'asc' }] as const;

export async function listPublicCatalogue(prisma: PrismaClient): Promise<PublicService[]> {
  const [services, sharedAddons] = await Promise.all([
    prisma.service.findMany({
      where: { isActive: true },
      orderBy: [...ORDER],
      include: {
        packages: { where: { isActive: true }, orderBy: [...ORDER] },
        addons: { where: { isActive: true }, orderBy: [...ORDER] },
      },
    }),
    prisma.addon.findMany({ where: { isActive: true, serviceId: null }, orderBy: [...ORDER] }),
  ]);

  return services.map((service) => ({
    id: service.id,
    slug: service.slug,
    nameEn: service.nameEn,
    descriptionEn: service.descriptionEn,
    coverImageUrl: service.coverImageUrl,
    packages: service.packages.map((pkg) => ({
      id: pkg.id,
      nameEn: pkg.nameEn,
      descriptionEn: pkg.descriptionEn,
      priceRwf: pkg.priceRwf,
      photoCount: pkg.photoCount,
      durationMinutes: pkg.durationMinutes,
    })),
    addons: [...service.addons, ...sharedAddons].map((addon) => ({
      id: addon.id,
      nameEn: addon.nameEn,
      priceRwf: addon.priceRwf,
    })),
  }));
}
