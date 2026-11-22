import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { logger, securityEvent } from "../../lib/logger";
import { notifyPaidCheckout } from "../notifications/notify";

export const webhookEventSchema = z.object({
  type: z.enum(["charge.succeeded", "charge.failed"]),
  data: z.object({
    chargeId: z.string().min(1).max(80),
    checkoutId: z.string().min(1).max(40),
    amountCents: z.number().int().nonnegative(),
    method: z.enum(["CARD", "YAPE", "PLIN"]),
    failureMessage: z.string().max(200).optional(),
  }),
});
export type WebhookEvent = z.infer<typeof webhookEventSchema>;

class OutOfStock extends Error {}

/**
 * HU-12: procesa la confirmación de la pasarela. Es idempotente (la pasarela puede reenviar el evento).
 * El cambio a «Pagado» y el descuento de stock ocurren en una sola transacción ACID.
 */
export async function processPaymentEvent(event: WebhookEvent): Promise<{ status: string }> {
  const { data } = event;
  const checkout = await prisma.checkout.findUnique({ where: { id: data.checkoutId }, include: { orders: { include: { items: true } } } });
  if (!checkout) return { status: "ignored" };
  if (checkout.status !== "PENDING_PAYMENT") return { status: "already-processed" };

  if (event.type === "charge.failed") {
    // El pedido sigue «Pendiente de pago» y el stock no cambia: el cliente puede reintentar.
    await prisma.checkout.update({ where: { id: checkout.id }, data: { failureReason: data.failureMessage ?? "Pago rechazado" } });
    return { status: "payment-failed" };
  }

  if (data.amountCents !== checkout.totalCents) {
    securityEvent("payment_amount_mismatch", { checkoutId: checkout.id, expected: checkout.totalCents, got: data.amountCents });
    return { status: "amount-mismatch" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const item of checkout.orders.flatMap((o) => o.items)) {
        // Descuento condicional: evita vender la misma flor dos veces con compras simultáneas.
        const updated = await tx.product.updateMany({
          where: { id: item.productId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (updated.count === 0) throw new OutOfStock(item.name);
      }
      await tx.checkout.update({
        where: { id: checkout.id },
        data: { status: "PAID", paidAt: new Date(), chargeId: data.chargeId, paymentMethod: data.method, failureReason: null },
      });
      for (const order of checkout.orders) {
        await tx.order.update({ where: { id: order.id }, data: { status: "PAID", events: { create: { status: "PAID" } } } });
      }
    });
  } catch (err) {
    if (!(err instanceof OutOfStock)) throw err;
    await prisma.checkout.update({ where: { id: checkout.id }, data: { status: "FAILED", failureReason: `Sin stock: ${err.message}. Se reembolsará el pago.` } });
    logger.warn({ checkoutId: checkout.id }, "Pago recibido sin stock suficiente: requiere reembolso");
    return { status: "out-of-stock" };
  }
  await notifyPaidCheckout(checkout.id);
  return { status: "paid" };
}
