import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { notFound } from "../../lib/errors";
import { parse } from "../../middleware/validate";
import { CATEGORIES, OCCASIONS, toDto } from "../products/products.routes";
import type { Prisma } from "../../generated/prisma/client";

export const catalogRouter = Router();
export const PAGE_SIZE = 20;

const soles = z.coerce.number().min(0).max(100_000).transform((n) => Math.round(n * 100));

const querySchema = z.object({
  q: z.string().trim().max(60).optional(),
  category: z.enum(CATEGORIES).optional(),
  occasion: z.enum(OCCASIONS).optional(),
  minPrice: soles.optional(),
  maxPrice: soles.optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
});

const publicStall = { select: { id: true, name: true, number: true, pavilion: true } } as const;

// HU-08 / HU-09: catálogo público (sin sesión) de puestos aprobados, con búsqueda y filtros.
catalogRouter.get("/products", async (req, res) => {
  const f = parse(querySchema, req.query);
  const where: Prisma.ProductWhereInput = {
    active: true,
    stall: { status: "APPROVED" },
    ...(f.category && { category: f.category }),
    ...(f.occasion && { occasion: f.occasion }),
    ...((f.minPrice !== undefined || f.maxPrice !== undefined) && {
      priceCents: { ...(f.minPrice !== undefined && { gte: f.minPrice }), ...(f.maxPrice !== undefined && { lte: f.maxPrice }) },
    }),
    ...(f.q && {
      OR: [
        { name: { contains: f.q, mode: "insensitive" } },
        { description: { contains: f.q, mode: "insensitive" } },
        { category: { contains: f.q, mode: "insensitive" } },
      ],
    }),
  };
  const [total, items] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: [{ stock: "desc" }, { createdAt: "desc" }],
      skip: (f.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { stall: publicStall },
    }),
  ]);
  res.json({
    items: items.map(toDto),
    page: f.page,
    pageSize: PAGE_SIZE,
    total,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    // HU-09: sugerencias cuando no hay resultados
    suggestions: total === 0 ? ["rosas", "girasoles", "arreglos"] : [],
  });
});

// HU-11: perfil público del puesto (solo aprobados).
catalogRouter.get("/stalls/:id", async (req, res) => {
  const stall = await prisma.stall.findFirst({
    where: { id: String(req.params.id), status: "APPROVED" },
    select: {
      id: true,
      name: true,
      number: true,
      pavilion: true,
      schedule: true,
      products: { where: { active: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!stall) throw notFound("Puesto no encontrado");
  res.json({ ...stall, products: stall.products.map(toDto) });
});
