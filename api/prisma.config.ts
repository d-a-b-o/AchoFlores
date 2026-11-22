import { defineConfig } from "prisma/config";

// Prisma 7 no carga .env automáticamente: DATABASE_URL viene del entorno
// (GitHub Actions, Render o un `export` local).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "postgresql://postgres:test@localhost:5432/achoflores_test",
  },
});
