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
