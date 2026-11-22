import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { badRequest, forbidden, notFound } from "../../lib/errors";
import { detectImageType, MAX_IMAGE_BYTES } from "../../lib/image";
import { saveImage } from "../../lib/storage";
import { requireAuth, requireRole } from "../../middleware/auth";
import { parse } from "../../middleware/validate";
import type { Prisma } from "../../generated/prisma/client";

export const productsRouter = Router();
export const imagesRouter = Router();

export const CATEGORIES = ["rosas", "girasoles", "lirios", "claveles", "orquideas", "tulipanes", "arreglos", "coronas", "otros"] as const;
export const OCCASIONS = ["cumpleanos", "aniversario", "san-valentin", "dia-de-la-madre", "todos-los-santos", "condolencias", "eventos", "otros"] as const;

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } });

const money = z.coerce.number().positive("El precio debe ser mayor a 0").max(100_000).transform((n) => Math.round(n * 100));

const optionalNumber = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === "" || v === null ? undefined : v), schema.optional());

const productFields = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional(),
  category: z.enum(CATEGORIES),
  occasion: z.enum(OCCASIONS).optional(),
  price: money,
  stock: z.coerce.number().int().min(0).max(100_000),
  // HU-07: precio por mayor (opcional) y cantidad mínima para aplicarlo
  wholesalePrice: optionalNumber(money),
  wholesaleMinQty: optionalNumber(z.coerce.number().int().min(2).max(10_000)),
});

const wholesaleRules = <T extends { price?: number; wholesalePrice?: number; wholesaleMinQty?: number }>(d: T, ctx: z.RefinementCtx) => {
  if ((d.wholesalePrice === undefined) !== (d.wholesaleMinQty === undefined)) {
    ctx.addIssue({ code: "custom", path: ["wholesaleMinQty"], message: "Indica precio por mayor y cantidad mínima juntos" });
  }
  if (d.wholesalePrice !== undefined && d.price !== undefined && d.wholesalePrice >= d.price) {
    ctx.addIssue({ code: "custom", path: ["wholesalePrice"], message: "El precio por mayor debe ser menor al precio unitario" });
  }
};

const productSchema = productFields.superRefine(wholesaleRules);

const productUpdateSchema = productFields
  .partial()
  .extend({
    active: z.preprocess((v) => (v === "true" ? true : v === "false" ? false : v), z.boolean()).optional(),
  })
  .superRefine(wholesaleRules);

function toData(d: { price?: number; wholesalePrice?: number; wholesaleMinQty?: number }) {
  const { price, wholesalePrice, wholesaleMinQty, ...rest } = d;
  return {
    ...rest,
    ...(price !== undefined && { priceCents: price }),
    ...(wholesalePrice !== undefined && { wholesalePriceCents: wholesalePrice, wholesaleMinQty }),
  };
}

async function approvedStallOf(userId: string) {
  const stall = await prisma.stall.findUnique({ where: { ownerId: userId } });
  if (!stall) throw forbidden("Primero registra tu puesto");
  if (stall.status !== "APPROVED") throw forbidden("Tu puesto aún no está aprobado");
  return stall;
}

async function storeUploadedImage(file?: Express.Multer.File) {
  if (!file) return undefined;
  const type = detectImageType(file.buffer);
  if (!type) throw badRequest("El archivo debe ser una imagen JPG, PNG o WebP", "INVALID_IMAGE");
  return saveImage(file.buffer, type);
}

export const toDto = <T extends { priceCents: number; wholesalePriceCents?: number | null }>(p: T) => ({
  ...p,
  price: p.priceCents / 100,
  wholesalePrice: p.wholesalePriceCents != null ? p.wholesalePriceCents / 100 : null,
});

// HU-05: publicar producto con foto, precio y stock.
productsRouter.post("/", requireAuth, requireRole("MERCHANT"), upload.single("image"), async (req, res) => {
  const stall = await approvedStallOf(req.user!.id);
  const data = parse(productSchema, req.body);
  if (!req.file) throw badRequest("La foto del producto es obligatoria", "IMAGE_REQUIRED");
  const imageUrl = (await storeUploadedImage(req.file))!;
  const product = await prisma.product.create({
    data: { ...toData(data), priceCents: data.price, imageUrl, stallId: stall.id } as Prisma.ProductUncheckedCreateInput,
  });
  res.status(201).json(toDto(product));
});

productsRouter.get("/mine", requireAuth, requireRole("MERCHANT"), async (req, res) => {
  const stall = await approvedStallOf(req.user!.id);
  const products = await prisma.product.findMany({ where: { stallId: stall.id }, orderBy: { createdAt: "desc" } });
  res.json(products.map(toDto));
});

// HU-06: editar, desactivar o actualizar stock (solo productos de su propio puesto).
productsRouter.patch("/:id", requireAuth, requireRole("MERCHANT"), upload.single("image"), async (req, res) => {
  const stall = await approvedStallOf(req.user!.id);
  const product = await prisma.product.findUnique({ where: { id: String(req.params.id) } });
  if (!product) throw notFound("Producto no encontrado");
  if (product.stallId !== stall.id) throw forbidden("Este producto no pertenece a tu puesto");

  const data = parse(productUpdateSchema, req.body);
  // El precio por mayor debe seguir siendo menor al unitario después del cambio.
  const finalPrice = data.price ?? product.priceCents;
  const finalWholesale = data.wholesalePrice ?? product.wholesalePriceCents;
  if (finalWholesale != null && finalWholesale >= finalPrice) {
    throw badRequest("El precio por mayor debe ser menor al precio unitario", "INVALID_WHOLESALE");
  }
  const imageUrl = await storeUploadedImage(req.file);
  const updated = await prisma.product.update({
    where: { id: product.id },
    data: { ...toData(data), ...(imageUrl && { imageUrl }) },
  });
  res.json(toDto(updated));
});

productsRouter.get("/meta", (_req, res) => {
  res.json({ categories: CATEGORIES, occasions: OCCASIONS });
});

imagesRouter.get("/:id", async (req, res) => {
  const blob = await prisma.imageBlob.findUnique({ where: { id: String(req.params.id) } });
  if (!blob) throw notFound("Imagen no encontrada");
  res.setHeader("Content-Type", blob.mimeType);
  res.setHeader("Cache-Control", "public, max-age=86400, immutable");
  res.send(Buffer.from(blob.data));
});
