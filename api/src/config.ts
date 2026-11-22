import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1).default("postgresql://postgres:test@localhost:5432/achoflores_test"),
  JWT_SECRET: z.string().min(32).optional(),
  JWT_EXPIRES_IN: z.string().default("2h"),
  CORS_ORIGIN: z.string().optional(),
  CLOUDINARY_URL: z.string().optional(),
  WEB_DIST: z.string().optional(),
  PUBLIC_URL: z.string().url().default("http://localhost:5173"),
  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().default("AchoFlores <onboarding@resend.dev>"),
  PAYMENT_WEBHOOK_SECRET: z.string().min(32).optional(),
  LOG_LEVEL: z.string().default("info"),
});

const parsed = schema.parse(process.env);

if (parsed.NODE_ENV === "production" && (!parsed.JWT_SECRET || !parsed.PAYMENT_WEBHOOK_SECRET)) {
  throw new Error("JWT_SECRET y PAYMENT_WEBHOOK_SECRET son obligatorios en producción (mínimo 32 caracteres)");
}

export const config = {
  ...parsed,
  // En desarrollo y pruebas se usa un secreto local que nunca llega a producción.
  JWT_SECRET: parsed.JWT_SECRET ?? "dev-only-secret-not-for-production-use-0000",
  PAYMENT_WEBHOOK_SECRET: parsed.PAYMENT_WEBHOOK_SECRET ?? "dev-only-webhook-secret-not-for-production-00",
  isTest: parsed.NODE_ENV === "test",
};
