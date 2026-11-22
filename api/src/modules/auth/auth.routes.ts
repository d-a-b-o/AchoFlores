import { Router } from "express";
import rateLimit from "express-rate-limit";
import { config } from "../../config";
import { parse } from "../../middleware/validate";
import { requireAuth } from "../../middleware/auth";
import { z } from "zod";
import { loginSchema, passwordSchema, registerSchema } from "./auth.schemas";
import { requestReset, resetPassword } from "./password-reset";
import * as auth from "./auth.service";

export const authRouter = Router();

// Rate limiting por IP en endpoints sensibles (fuerza bruta / credential stuffing).
const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: config.isTest ? 1000 : 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Intenta más tarde.", code: "RATE_LIMITED" },
});

authRouter.post("/register", authLimiter, async (req, res) => {
  const result = await auth.register(parse(registerSchema, req.body));
  res.status(201).json(result);
});

authRouter.post("/login", authLimiter, async (req, res) => {
  res.json(await auth.login(parse(loginSchema, req.body), req.ip));
});

authRouter.get("/me", requireAuth, async (req, res) => {
  res.json(await auth.me(req.user!.id));
});

// HU-21: recuperar contraseña por correo.
authRouter.post("/forgot-password", authLimiter, async (req, res) => {
  const { email } = parse(z.object({ email: z.string().trim().toLowerCase().email().max(254) }), req.body);
  await requestReset(email);
  res.status(202).json({ message: "Si el correo está registrado, te enviamos un enlace para recuperar tu contraseña." });
});

authRouter.post("/reset-password", authLimiter, async (req, res) => {
  const { token, password } = parse(z.object({ token: z.string().min(20).max(200), password: passwordSchema }), req.body);
  await resetPassword(token, password);
  res.json({ message: "Contraseña actualizada. Ya puedes ingresar." });
});
