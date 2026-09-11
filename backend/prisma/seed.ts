import 'dotenv/config';
import { createPrismaClient } from '../src/db/client.js';
import { seedDatabase } from '../src/db/seed.js';

const prisma = createPrismaClient();

try {
  const summary = await seedDatabase(prisma);
  console.log(JSON.stringify(summary));
} finally {
  await prisma.$disconnect();
}
