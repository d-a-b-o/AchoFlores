import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { badRequest, forbidden, notFound } from "../../lib/errors";
import { detectImageType, MAX_IMAGE_BYTES } from "../../lib/image";
import { saveImage } from "../../lib/storage";
import { requireAuth, requireRole } from "../../middleware/auth";
import { parse } from "../../middleware/validate";

export const productsRouter = Router();
export const imagesRouter = Router();

export const CATEGORIES = ["rosas", "girasoles", "lirios", "claveles", "orquideas", "tulipanes", "arreglos", "coronas", "otros"] as const;
export const OCCASIONS = ["cumpleanos", "aniversario", "san-valentin", "dia-de-la-madre", "todos-los-santos", "condolencias", "eventos", "otros"] as const;

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } });

const money = z.coerce.number().positive("El precio debe ser mayor a 0").max(100_000).transform((n) => Math.round(n * 100));

const productSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional(),
  category: z.enum(CATEGORIES),
  occasion: z.enum(OCCASIONS).optional(),
  price: money,
  stock: z.coerce.number().int().min(0).max(100_000),
});

const productUpdateSchema = productSchema.partial().extend({
  active: z.preprocess((v) => (v === "true" ? true : v === "false" ? false : v), z.boolean()).optional(),
});

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

const toDto = <T extends { priceCents: number }>(p: T) => ({ ...p, price: p.priceCents / 100 });

// HU-05: publicar producto con foto, precio y stock.
productsRouter.post("/", requireAuth, requireRole("MERCHANT"), upload.single("image"), async (req, res) => {
  const stall = await approvedStallOf(req.user!.id);
  const { price, ...data } = parse(productSchema, req.body);
  if (!req.file) throw badRequest("La foto del producto es obligatoria", "IMAGE_REQUIRED");
  const imageUrl = (await storeUploadedImage(req.file))!;
  const product = await prisma.product.create({ data: { ...data, priceCents: price, imageUrl, stallId: stall.id } });
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

  const { price, ...data } = parse(productUpdateSchema, req.body);
  const imageUrl = await storeUploadedImage(req.file);
  const updated = await prisma.product.update({
    where: { id: product.id },
    data: { ...data, ...(price !== undefined && { priceCents: price }), ...(imageUrl && { imageUrl }) },
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
