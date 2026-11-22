import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { requireAuth, requireRole } from "../../middleware/auth";

export const customerOrdersRouter = Router();

// HU-17: «Mis pedidos» con estado e historial (solo las compras del propio cliente).
customerOrdersRouter.get("/", requireAuth, requireRole("CUSTOMER"), async (req, res) => {
  const checkouts = await prisma.checkout.findMany({
    where: { customerId: req.user!.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      orders: {
        include: {
          items: true,
          stall: { select: { name: true, number: true } },
          events: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });
  res.json(checkouts);
});
