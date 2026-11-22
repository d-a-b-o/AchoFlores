/**
 * Seed idempotente: se ejecuta en cada arranque del contenedor.
 * - SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD: crea (una vez) la cuenta administradora.
 * - SEED_DEMO=true: crea un puesto y productos de demostración.
 */
import bcrypt from "bcryptjs";
import { prisma } from "./lib/prisma";
import { logger } from "./lib/logger";

const flower = (emoji: string, bg: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${bg}"/><text x="50" y="66" font-size="52" text-anchor="middle">${emoji}</text></svg>`,
  )}`;

const DEMO_PRODUCTS = [
  { name: "Docena de rosas rojas", category: "rosas", occasion: "san-valentin", priceCents: 3500, wholesalePriceCents: 3000, wholesaleMinQty: 5, stock: 60, imageUrl: flower("🌹", "#fde2e7") },
  { name: "Ramo de girasoles (6 u.)", category: "girasoles", occasion: "cumpleanos", priceCents: 2800, stock: 25, imageUrl: flower("🌻", "#fff3c4") },
  { name: "Arreglo de lirios blancos", category: "lirios", occasion: "condolencias", priceCents: 6500, stock: 8, imageUrl: flower("💐", "#eef3f8") },
  { name: "Tulipanes surtidos (10 u.)", category: "tulipanes", occasion: "dia-de-la-madre", priceCents: 5200, stock: 15, imageUrl: flower("🌷", "#fbe7f1") },
];

async function main() {
  const { SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_DEMO } = process.env;

  if (SEED_ADMIN_EMAIL && SEED_ADMIN_PASSWORD) {
    const email = SEED_ADMIN_EMAIL.toLowerCase();
    const exists = await prisma.user.findUnique({ where: { email } });
    if (!exists) {
      await prisma.user.create({
        data: { email, name: "Administración Mercado de Acho", role: "ADMIN", passwordHash: await bcrypt.hash(SEED_ADMIN_PASSWORD, 10), consentAt: new Date() },
      });
      logger.info("Cuenta administradora creada");
    }
  }

  if (SEED_DEMO === "true") {
    const email = "demo.comerciante@achoflores.pe";
    if (!(await prisma.user.findUnique({ where: { email } }))) {
      await prisma.user.create({
        data: {
          email,
          name: "Rosa Quispe (demo)",
          role: "MERCHANT",
          passwordHash: await bcrypt.hash(process.env.SEED_DEMO_PASSWORD ?? "demo-acho-2026", 10),
          consentAt: new Date(),
          stall: {
            create: {
              name: "Flores Doña Rosa",
              number: "B-12",
              pavilion: "B",
              schedule: "Lun-Dom 5:00-17:00",
              documentType: "DNI",
              documentNumber: "45678912",
              status: "APPROVED",
              reviewedAt: new Date(),
              products: { create: DEMO_PRODUCTS },
            },
          },
        },
      });
      logger.info("Datos de demostración creados");
    }
  }
}

main()
  .catch((err) => {
    logger.error({ err }, "Seed falló");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
