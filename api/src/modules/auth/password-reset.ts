import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma";
import { badRequest } from "../../lib/errors";
import { securityEvent } from "../../lib/logger";
import { sendMail } from "../../lib/mailer";
import { config } from "../../config";

export const RESET_TTL_MINUTES = 30;
const sha256 = (v: string) => crypto.createHash("sha256").update(v).digest("hex");

/** HU-21: siempre responde igual, exista o no la cuenta (no revela usuarios). */
export async function requestReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return;
  const token = crypto.randomBytes(32).toString("base64url");
  await prisma.passwordReset.create({
    data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60_000) },
  });
  securityEvent("password_reset_requested", { userId: user.id });
  await sendMail({
    to: user.email,
    subject: "Recupera tu contraseña de AchoFlores",
    text: `Hola ${user.name}:\n\nPara crear una nueva contraseña entra a este enlace (vence en ${RESET_TTL_MINUTES} minutos y solo funciona una vez):\n${config.PUBLIC_URL}/restablecer?token=${token}\n\nSi no lo pediste, ignora este correo.`,
  });
}

export async function resetPassword(token: string, password: string) {
  const reset = await prisma.passwordReset.findUnique({ where: { tokenHash: sha256(token) } });
  if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
    throw badRequest("El enlace no es válido o ya venció. Solicita uno nuevo.", "INVALID_RESET_TOKEN");
  }
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.$transaction([
    prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
    prisma.user.update({ where: { id: reset.userId }, data: { passwordHash, failedLogins: 0, lockedUntil: null } }),
  ]);
  securityEvent("password_reset_completed", { userId: reset.userId });
}
