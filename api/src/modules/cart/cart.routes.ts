import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { parse } from "../../middleware/validate";
import { unitPriceCents } from "../../lib/pricing";

export const cartRouter = Router();

const quoteSchema = z.object({
  items: z
    .array(z.object({ productId: z.string().min(1).max(40), quantity: z.number().int().min(1).max(10_000) }))
    .max(50),
});

export interface QuoteLine {
  productId: string;
  name: string;
  imageUrl: string;
  quantity: number;
  requested: number;
  unitPriceCents: number;
  wholesaleApplied: boolean;
  lineTotalCents: number;
}

export async function quoteCart(items: { productId: string; quantity: number }[]) {
  const ids = [...new Set(items.map((i) => i.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: ids }, active: true, stall: { status: "APPROVED" } },
    include: { stall: { select: { id: true, name: true, number: true } } },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  const warnings: string[] = [];
  const groups = new Map<string, { stall: { id: string; name: string; number: string }; lines: QuoteLine[]; subtotalCents: number }>();

  for (const item of items) {
    const p = byId.get(item.productId);
    if (!p || p.stock === 0) {
      warnings.push(p ? `«${p.name}» está agotado` : "Un producto ya no está disponible");
      continue;
    }
    // HU-10: la cantidad se limita al stock disponible.
    const quantity = Math.min(item.quantity, p.stock);
    if (quantity < item.quantity) warnings.push(`«${p.name}»: solo hay ${p.stock} disponibles`);
    const unit = unitPriceCents(p, quantity);
    const line: QuoteLine = {
      productId: p.id,
      name: p.name,
      imageUrl: p.imageUrl,
      quantity,
      requested: item.quantity,
      unitPriceCents: unit,
      wholesaleApplied: unit !== p.priceCents,
      lineTotalCents: unit * quantity,
    };
    const g = groups.get(p.stallId) ?? { stall: p.stall, lines: [], subtotalCents: 0 };
    g.lines.push(line);
    g.subtotalCents += line.lineTotalCents;
    groups.set(p.stallId, g);
  }

  const stalls = [...groups.values()];
  return { stalls, totalCents: stalls.reduce((s, g) => s + g.subtotalCents, 0), warnings };
}

// HU-10: el carrito vive en el navegador; el servidor recalcula precios y stock (nunca confía en el cliente).
cartRouter.post("/quote", async (req, res) => {
  const { items } = parse(quoteSchema, req.body);
  res.json(await quoteCart(items));
});
