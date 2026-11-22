import { afterAll, beforeEach } from "vitest";
import { prisma } from "../src/lib/prisma";

beforeEach(async () => {
  const tables = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
    `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'`,
  );
  if (tables.length) {
    await prisma.$executeRawUnsafe(
      `TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`,
    );
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});
