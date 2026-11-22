import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { badRequest, notFound } from "../../lib/errors";
import { securityEvent } from "../../lib/logger";
import { requireAuth, requireRole } from "../../middleware/auth";
import { parse } from "../../middleware/validate";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole("ADMIN"));

const statusQuery = z.object({ status: z.enum(["PENDING", "APPROVED", "REJECTED"]).default("PENDING") });

adminRouter.get("/stalls", async (req, res) => {
  const { status } = parse(statusQuery, req.query);
  const stalls = await prisma.stall.findMany({
    where: { status },
    orderBy: { createdAt: "asc" },
    include: { owner: { select: { name: true, email: true } } },
  });
  res.json(stalls);
});

async function pendingStall(id: string) {
  const stall = await prisma.stall.findUnique({ where: { id } });
  if (!stall) throw notFound("Puesto no encontrado");
  if (stall.status !== "PENDING") throw badRequest("El puesto ya fue revisado", "ALREADY_REVIEWED");
  return stall;
}

// HU-04: aprobar → el puesto y sus productos se vuelven visibles.
adminRouter.post("/stalls/:id/approve", async (req, res) => {
  const stall = await pendingStall(String(req.params.id));
  const updated = await prisma.stall.update({
    where: { id: stall.id },
    data: { status: "APPROVED", reviewedAt: new Date(), rejectionReason: null },
  });
  securityEvent("stall_approved", { stallId: stall.id, adminId: req.user!.id });
  res.json(updated);
});

// HU-04: rechazar exige un motivo que ve el comerciante.
adminRouter.post("/stalls/:id/reject", async (req, res) => {
  const { reason } = parse(z.object({ reason: z.string().trim().min(5, "Indica el motivo del rechazo").max(300) }), req.body);
  const stall = await pendingStall(String(req.params.id));
  const updated = await prisma.stall.update({
    where: { id: stall.id },
    data: { status: "REJECTED", reviewedAt: new Date(), rejectionReason: reason },
  });
  securityEvent("stall_rejected", { stallId: stall.id, adminId: req.user!.id });
  res.json(updated);
});
