import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { conflict, notFound } from "../../lib/errors";
import { requireAuth, requireRole } from "../../middleware/auth";
import { parse } from "../../middleware/validate";

export const stallsRouter = Router();

export const stallSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    number: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{1,10}$/, "Número de puesto inválido"),
    pavilion: z.string().trim().min(1).max(40),
    schedule: z.string().trim().min(3).max(80),
    documentType: z.enum(["DNI", "RUC"]),
    documentNumber: z.string().trim(),
  })
  .refine((s) => (s.documentType === "DNI" ? /^\d{8}$/ : /^(10|20)\d{9}$/).test(s.documentNumber), {
    message: "DNI debe tener 8 dígitos y RUC 11 dígitos (empieza con 10 o 20)",
    path: ["documentNumber"],
  });

// HU-03: el comerciante registra su puesto → queda «Pendiente de aprobación».
stallsRouter.post("/", requireAuth, requireRole("MERCHANT"), async (req, res) => {
  const data = parse(stallSchema, req.body);
  const [mine, sameNumber] = await Promise.all([
    prisma.stall.findUnique({ where: { ownerId: req.user!.id } }),
    prisma.stall.findUnique({ where: { number: data.number } }),
  ]);
  if (mine) throw conflict("Ya registraste un puesto", "STALL_EXISTS");
  if (sameNumber) throw conflict(`El puesto ${data.number} ya está registrado`, "STALL_NUMBER_TAKEN");

  const stall = await prisma.stall.create({ data: { ...data, ownerId: req.user!.id } });
  res.status(201).json(stall);
});

stallsRouter.get("/me", requireAuth, requireRole("MERCHANT"), async (req, res) => {
  const stall = await prisma.stall.findUnique({ where: { ownerId: req.user!.id } });
  if (!stall) throw notFound("Aún no registras tu puesto");
  res.json(stall);
});
