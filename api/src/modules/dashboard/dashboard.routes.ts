import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { forbidden } from "../../lib/errors";
import { requireAuth, requireRole } from "../../middleware/auth";

export const dashboardRouter = Router();

const SOLD = ["PAID", "PREPARING", "READY", "SHIPPED", "DELIVERED"] as const;

async function summary(stallId: string, days: number) {
  const since = new Date(Date.now() - days * 86_400_000);
  const orders = await prisma.order.findMany({
    where: { stallId, status: { in: [...SOLD] }, createdAt: { gte: since } },
    include: { items: true },
  });
  const products = new Map<string, { name: string; quantity: number; salesCents: number }>();
  const byDay = new Map<string, number>();
  for (const o of orders) {
    const day = o.createdAt.toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + o.subtotalCents);
    for (const i of o.items) {
      const p = products.get(i.productId) ?? { name: i.name, quantity: 0, salesCents: 0 };
      p.quantity += i.quantity;
      p.salesCents += i.quantity * i.unitPriceCents;
      products.set(i.productId, p);
    }
  }
  return {
    days,
    salesCents: orders.reduce((s, o) => s + o.subtotalCents, 0),
    orders: orders.length,
    topProducts: [...products.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5),
    byDay: [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, salesCents]) => ({ day, salesCents })),
  };
}

// HU-20: ventas, pedidos y productos más vendidos de los últimos 7 y 30 días.
dashboardRouter.get("/", requireAuth, requireRole("MERCHANT"), async (req, res) => {
  const stall = await prisma.stall.findUnique({ where: { ownerId: req.user!.id } });
  if (!stall || stall.status !== "APPROVED") throw forbidden("Tu puesto aún no está aprobado");
  const [last7, last30] = await Promise.all([summary(stall.id, 7), summary(stall.id, 30)]);
  res.json({ last7, last30 });
});
