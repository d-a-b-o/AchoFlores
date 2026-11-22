import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma";
import { conflict, HttpError, unauthorized } from "../../lib/errors";
import { securityEvent } from "../../lib/logger";
import { signToken } from "../../middleware/auth";
import type { z } from "zod";
import type { loginSchema, registerSchema } from "./auth.schemas";

export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;
const BCRYPT_ROUNDS = 10;

type PublicUser = { id: string; email: string; name: string; role: string };
const toPublic = (u: PublicUser): PublicUser => ({ id: u.id, email: u.email, name: u.name, role: u.role });

export async function register(input: z.infer<typeof registerSchema>) {
  const exists = await prisma.user.findUnique({ where: { email: input.email } });
  if (exists) throw conflict("Este correo ya tiene una cuenta", "EMAIL_TAKEN");

  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      role: input.accountType,
      passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
      consentAt: new Date(),
    },
  });
  return { user: toPublic(user), token: signToken(user) };
}

export async function login(input: z.infer<typeof loginSchema>, ip?: string) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  // Mensaje genérico: no revela si el correo existe.
  const invalid = unauthorized("Credenciales inválidas");

  if (!user) {
    securityEvent("login_failed_unknown_user", { ip });
    throw invalid;
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    securityEvent("login_blocked", { userId: user.id, ip });
    throw new HttpError(423, `Cuenta bloqueada temporalmente. Intenta en ${LOCK_MINUTES} minutos.`, "ACCOUNT_LOCKED");
  }

  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok) {
    const failed = user.failedLogins + 1;
    const lock = failed >= MAX_FAILED_LOGINS;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLogins: lock ? 0 : failed,
        lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : user.lockedUntil,
      },
    });
    securityEvent(lock ? "account_locked" : "login_failed", { userId: user.id, ip, failed });
    throw invalid;
  }

  if (user.failedLogins > 0 || user.lockedUntil) {
    await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
  }
  return { user: toPublic(user), token: signToken(user) };
}

export async function me(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { stall: true } });
  if (!user) throw unauthorized();
  return { ...toPublic(user), stall: user.stall };
}
