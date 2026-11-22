import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { signToken } from "../src/middleware/auth";
import type { Role } from "../src/generated/prisma/enums";

let seq = 0;

export async function createUser(role: Role = "CUSTOMER", password = "secreto123") {
  seq += 1;
  const user = await prisma.user.create({
    data: {
      email: `user${seq}-${role.toLowerCase()}@test.pe`,
      name: `Usuario ${seq}`,
      role,
      passwordHash: await bcrypt.hash(password, 4),
      consentAt: new Date(),
    },
  });
  return { user, token: signToken(user), auth: { Authorization: `Bearer ${signToken(user)}` } };
}

export async function createApprovedMerchant() {
  const merchant = await createUser("MERCHANT");
  seq += 1;
  const stall = await prisma.stall.create({
    data: {
      ownerId: merchant.user.id,
      name: `Flores ${seq}`,
      number: `A-${seq}`,
      pavilion: "A",
      schedule: "Lun-Dom 6:00-18:00",
      documentType: "DNI",
      documentNumber: "12345678",
      status: "APPROVED",
    },
  });
  return { ...merchant, stall };
}

// PNG 1x1 válido para pruebas de subida de imágenes.
export const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

export async function createProduct(stallId: string, data: Partial<{ name: string; category: string; occasion: string; priceCents: number; stock: number; active: boolean; wholesalePriceCents: number; wholesaleMinQty: number; description: string }> = {}) {
  return prisma.product.create({
    data: { stallId, name: "Rosas rojas", category: "rosas", priceCents: 3000, stock: 20, imageUrl: "/api/images/x", ...data },
  });
}
