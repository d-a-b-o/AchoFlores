import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .max(72, "La contraseña es demasiado larga")
  .regex(/\d/, "La contraseña debe incluir al menos un número");

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email("Correo inválido").max(254),
  password: passwordSchema,
  name: z.string().trim().min(2).max(80),
  accountType: z.enum(["CUSTOMER", "MERCHANT"]).default("CUSTOMER"),
  acceptPrivacy: z.literal(true, {
    error: "Debes aceptar la política de tratamiento de datos personales (Ley N.º 29733)",
  }),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(72),
});
