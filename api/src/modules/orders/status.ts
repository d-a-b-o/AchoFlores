import type { OrderStatus } from "../../generated/prisma/enums";

/** HU-15: transiciones que puede hacer el comerciante. */
const TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  PAID: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY"],
  READY: ["SHIPPED", "DELIVERED"],
  SHIPPED: ["DELIVERED"],
};

export const canTransition = (from: OrderStatus, to: OrderStatus, fulfillment: "DELIVERY" | "PICKUP") => {
  if (!TRANSITIONS[from]?.includes(to)) return false;
  // Un pedido para recoger no se «envía»; uno con delivery debe enviarse antes de entregarse.
  if (fulfillment === "PICKUP" && to === "SHIPPED") return false;
  if (fulfillment === "DELIVERY" && from === "READY" && to === "DELIVERED") return false;
  return true;
};

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Pendiente de pago",
  PAID: "Pagado",
  PREPARING: "En preparación",
  READY: "Listo",
  SHIPPED: "Enviado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};
