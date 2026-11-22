import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { badRequest, notFound } from "../../lib/errors";
import { requireAuth, requireRole } from "../../middleware/auth";
import { parse } from "../../middleware/validate";
import { quoteCart } from "../cart/cart.routes";
import { deliveryFeeFor, DISTRICTS } from "./delivery";

export const checkoutRouter = Router();

const checkoutSchema = z
  .object({
    items: z.array(z.object({ productId: z.string().min(1).max(40), quantity: z.number().int().min(1).max(10_000) })).min(1).max(50),
    fulfillment: z.enum(["DELIVERY", "PICKUP"]),
    district: z.string().trim().max(60).optional(),
    address: z.string().trim().min(5).max(200).optional(),
    phone: z.string().trim().regex(/^9\d{8}$/, "Celular peruano de 9 dígitos que empieza con 9"),
    paymentMethod: z.enum(["CARD", "YAPE", "PLIN"]).default("CARD"),
    // HU-18: fecha de entrega programada (AAAA-MM-DD), entre 1 y 30 días después de hoy.
    scheduledFor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida").optional(),
  })
  .superRefine((d, ctx) => {
    if (d.fulfillment === "DELIVERY" && !d.address) ctx.addIssue({ code: "custom", path: ["address"], message: "Indica la dirección de entrega" });
    if (d.scheduledFor) {
      const days = daysFromToday(d.scheduledFor);
      if (!(days >= 1 && days <= 30)) ctx.addIssue({ code: "custom", path: ["scheduledFor"], message: "Programa la entrega entre 1 y 30 días desde hoy" });
    }
  });

/** Días entre hoy (hora de Lima, UTC-5) y la fecha dada. */
export function daysFromToday(isoDate: string, now = new Date()) {
  const today = new Date(now.getTime() - 5 * 3_600_000).toISOString().slice(0, 10);
  return Math.round((Date.parse(`${isoDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

checkoutRouter.get("/districts", (_req, res) => {
  res.json(DISTRICTS.map((d) => ({ district: d, feeCents: deliveryFeeFor(d) })));
});

// HU-14 + HU-12: crea la compra «Pendiente de pago». El stock se descuenta recién cuando la pasarela confirma.
checkoutRouter.post("/", requireAuth, requireRole("CUSTOMER"), async (req, res) => {
  const data = parse(checkoutSchema, req.body);
  let deliveryFeeCents = 0;
  if (data.fulfillment === "DELIVERY") {
    const fee = data.district ? deliveryFeeFor(data.district) : null;
    if (fee === null) throw badRequest("Tu distrito aún no tiene cobertura de delivery: elige recojo en el puesto", "NO_COVERAGE");
    deliveryFeeCents = fee;
  }

  const quote = await quoteCart(data.items);
  if (!quote.stalls.length) throw badRequest("Tu carrito no tiene productos disponibles", "EMPTY_CART");
  if (quote.warnings.length) throw badRequest(`Revisa tu carrito: ${quote.warnings.join("; ")}`, "CART_CHANGED");

  const checkout = await prisma.checkout.create({
    data: {
      customerId: req.user!.id,
      fulfillment: data.fulfillment,
      district: data.fulfillment === "DELIVERY" ? data.district : null,
      address: data.fulfillment === "DELIVERY" ? data.address : null,
      phone: data.phone,
      paymentMethod: data.paymentMethod,
      scheduledFor: data.scheduledFor ? new Date(`${data.scheduledFor}T12:00:00-05:00`) : null,
      deliveryFeeCents,
      itemsTotalCents: quote.totalCents,
      totalCents: quote.totalCents + deliveryFeeCents,
      orders: {
        create: quote.stalls.map((g) => ({
          stallId: g.stall.id,
          subtotalCents: g.subtotalCents,
          items: { create: g.lines.map((l) => ({ productId: l.productId, name: l.name, unitPriceCents: l.unitPriceCents, quantity: l.quantity })) },
          events: { create: { status: "PENDING_PAYMENT" } },
        })),
      },
    },
  });
  res.status(201).json({ id: checkout.id, totalCents: checkout.totalCents, status: checkout.status, paymentUrl: `/pasarela/${checkout.id}` });
});

checkoutRouter.get("/:id", requireAuth, async (req, res) => {
  const checkout = await prisma.checkout.findFirst({
    where: { id: String(req.params.id), customerId: req.user!.id },
    include: { orders: { include: { items: true, stall: { select: { name: true, number: true } } } } },
  });
  if (!checkout) throw notFound("Compra no encontrada");
  res.json(checkout);
});
