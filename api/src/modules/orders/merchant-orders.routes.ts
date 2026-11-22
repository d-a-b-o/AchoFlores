import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { badRequest, forbidden, notFound } from "../../lib/errors";
import { securityEvent } from "../../lib/logger";
import { requireAuth, requireRole } from "../../middleware/auth";
import { parse } from "../../middleware/validate";
import { canTransition } from "./status";

export const merchantOrdersRouter = Router();
merchantOrdersRouter.use(requireAuth, requireRole("MERCHANT"));

async function myStallId(userId: string) {
  const stall = await prisma.stall.findUnique({ where: { ownerId: userId } });
  if (!stall || stall.status !== "APPROVED") throw forbidden("Tu puesto aún no está aprobado");
  return stall.id;
}

const orderInclude = {
  items: true,
  events: { orderBy: { createdAt: "asc" } },
  checkout: { select: { fulfillment: true, district: true, address: true, phone: true, customer: { select: { name: true } } } },
} as const;

// HU-15: el comerciante solo ve los pedidos pagados de su propio puesto.
merchantOrdersRouter.get("/", async (req, res) => {
  const stallId = await myStallId(req.user!.id);
  const orders = await prisma.order.findMany({
    where: { stallId, status: { not: "PENDING_PAYMENT" } },
    orderBy: { createdAt: "desc" },
    include: orderInclude,
  });
  res.json(orders);
});

merchantOrdersRouter.patch("/:id/status", async (req, res) => {
  const { status } = parse(z.object({ status: z.enum(["PREPARING", "READY", "SHIPPED", "DELIVERED", "CANCELLED"]) }), req.body);
  const stallId = await myStallId(req.user!.id);
  const order = await prisma.order.findUnique({ where: { id: String(req.params.id) }, include: { checkout: true } });
  // 404 (no 403) para no revelar que existe un pedido de otro puesto.
  if (!order || order.stallId !== stallId) throw notFound("Pedido no encontrado");
  if (!canTransition(order.status, status, order.checkout.fulfillment)) {
    throw badRequest(`No se puede pasar de ${order.status} a ${status}`, "INVALID_TRANSITION");
  }
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { status, events: { create: { status } } },
    include: orderInclude,
  });
  securityEvent("order_status_changed", { orderId: order.id, from: order.status, to: status, by: req.user!.id });
  res.json(updated);
});
