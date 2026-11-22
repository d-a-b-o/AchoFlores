import { prisma } from "../../lib/prisma";
import { logger } from "../../lib/logger";
import { sendMail } from "../../lib/mailer";

const soles = (cents: number) => `S/ ${(cents / 100).toFixed(2)}`;
export const orderNumber = (checkoutId: string) => checkoutId.slice(-8).toUpperCase();

/**
 * Tras un pago confirmado:
 * - HU-13: correo de constancia al cliente (número, detalle por puesto y total).
 * - HU-19: aviso en el panel y correo a cada comerciante con pedidos en la compra.
 * Un fallo al notificar nunca revierte el pago: se registra para reintento.
 */
export async function notifyPaidCheckout(checkoutId: string) {
  try {
    const c = await prisma.checkout.findUniqueOrThrow({
      where: { id: checkoutId },
      include: {
        customer: true,
        orders: { include: { items: true, stall: { include: { owner: true } } } },
      },
    });
    const num = orderNumber(c.id);
    const detail = c.orders
      .map((o) => `${o.stall.name} (puesto ${o.stall.number}):\n${o.items.map((i) => `  - ${i.quantity} × ${i.name}: ${soles(i.unitPriceCents * i.quantity)}`).join("\n")}`)
      .join("\n\n");
    const delivery = c.fulfillment === "DELIVERY" ? `Delivery a ${c.district}: ${soles(c.deliveryFeeCents)}` : "Recojo en el puesto";
    const when = c.scheduledFor ? `\nEntrega programada: ${c.scheduledFor.toISOString().slice(0, 10)}` : "";

    await sendMail({
      to: c.customer.email,
      subject: `AchoFlores · Pedido ${num} confirmado`,
      text: `Hola ${c.customer.name}:\n\nRecibimos tu pago. Pedido N.º ${num}\n\n${detail}\n\n${delivery}${when}\nTotal pagado: ${soles(c.totalCents)}\n\nGracias por comprar en el Mercado de Flores de Acho.`,
    });

    for (const o of c.orders) {
      const title = `Nuevo pedido ${num}`;
      const body = `${o.items.map((i) => `${i.quantity} × ${i.name}`).join(", ")} — ${soles(o.subtotalCents)}${when ? ` (programado ${c.scheduledFor!.toISOString().slice(0, 10)})` : ""}`;
      await prisma.notification.create({ data: { userId: o.stall.ownerId, title, body, link: "/mi-puesto" } });
      await sendMail({ to: o.stall.owner.email, subject: `AchoFlores · ${title}`, text: `${body}\n\nRevisa tu panel para prepararlo.` });
    }
  } catch (err) {
    logger.error({ err, checkoutId }, "No se pudieron enviar las notificaciones del pedido (se reintentará)");
  }
}
