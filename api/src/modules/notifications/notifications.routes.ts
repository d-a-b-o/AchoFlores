import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { notFound } from "../../lib/errors";
import { requireAuth } from "../../middleware/auth";

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get("/", async (req, res) => {
  const items = await prisma.notification.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: "desc" }, take: 30 });
  res.json({ items, unread: items.filter((n) => !n.readAt).length });
});

notificationsRouter.post("/:id/read", async (req, res) => {
  const result = await prisma.notification.updateMany({
    where: { id: String(req.params.id), userId: req.user!.id, readAt: null },
    data: { readAt: new Date() },
  });
  if (result.count === 0) {
    const exists = await prisma.notification.findFirst({ where: { id: String(req.params.id), userId: req.user!.id } });
    if (!exists) throw notFound("Notificación no encontrada");
  }
  res.status(204).end();
});
