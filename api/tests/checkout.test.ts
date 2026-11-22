import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { config } from "../src/config";
import { sign, verifySignature } from "../src/modules/payments/signature";
import { canTransition } from "../src/modules/orders/status";
import { deliveryFeeFor } from "../src/modules/orders/delivery";
import { createApprovedMerchant, createProduct, createUser } from "./helpers";

const app = createApp();
const pickup = { fulfillment: "PICKUP", phone: "987654321" };

async function setup() {
  const a = await createApprovedMerchant();
  const b = await createApprovedMerchant();
  const rosa = await createProduct(a.stall.id, { name: "Rosa", priceCents: 300, stock: 50 });
  const lirio = await createProduct(b.stall.id, { name: "Lirio", priceCents: 1500, stock: 5 });
  const customer = await createUser("CUSTOMER");
  return { a, b, rosa, lirio, customer };
}

async function createCheckout(auth: Record<string, string>, items: { productId: string; quantity: number }[], extra: object = pickup) {
  return request(app).post("/api/checkout").set(auth).send({ items, ...extra });
}

function webhook(event: object, secret = config.PAYMENT_WEBHOOK_SECRET) {
  const body = JSON.stringify(event);
  return request(app).post("/api/payments/webhook").set("Content-Type", "application/json").set("x-signature", sign(body, secret)).send(body);
}

describe("HU-14 Delivery o recojo", () => {
  it("suma la tarifa de la zona del distrito con cobertura", async () => {
    const { rosa, customer } = await setup();
    const res = await createCheckout(customer.auth, [{ productId: rosa.id, quantity: 10 }], {
      fulfillment: "DELIVERY", district: "Miraflores", address: "Av. Larco 123", phone: "987654321",
    });
    expect(res.status).toBe(201);
    const c = await prisma.checkout.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(c).toMatchObject({ itemsTotalCents: 3000, deliveryFeeCents: 1200, totalCents: 4200, status: "PENDING_PAYMENT" });
  });

  it("un distrito sin cobertura solo permite recojo en el puesto", async () => {
    const { rosa, customer } = await setup();
    const res = await createCheckout(customer.auth, [{ productId: rosa.id, quantity: 1 }], {
      fulfillment: "DELIVERY", district: "Ancón", address: "Calle 1", phone: "987654321",
    });
    expect(res.body.code).toBe("NO_COVERAGE");
    const ok = await createCheckout(customer.auth, [{ productId: rosa.id, quantity: 1 }]);
    expect(ok.status).toBe(201);
    expect(ok.body.totalCents).toBe(300);
  });

  it("valida dirección y celular, y expone los distritos con su tarifa", async () => {
    const { rosa, customer } = await setup();
    expect((await createCheckout(customer.auth, [{ productId: rosa.id, quantity: 1 }], { fulfillment: "DELIVERY", district: "Rímac", phone: "987654321" })).status).toBe(400);
    expect((await createCheckout(customer.auth, [{ productId: rosa.id, quantity: 1 }], { ...pickup, phone: "12345" })).status).toBe(400);
    const d = await request(app).get("/api/checkout/districts");
    expect(d.body).toContainEqual({ district: "Rímac", feeCents: 800 });
    expect(deliveryFeeFor("Ancón")).toBeNull();
  });

  it("rechaza el checkout si el carrito cambió (stock insuficiente) o está vacío", async () => {
    const { lirio, customer } = await setup();
    expect((await createCheckout(customer.auth, [{ productId: lirio.id, quantity: 99 }])).body.code).toBe("CART_CHANGED");
    expect((await createCheckout(customer.auth, [{ productId: "nada", quantity: 1 }])).body.code).toBe("EMPTY_CART");
  });

  it("solo los clientes pueden comprar", async () => {
    const { rosa, a } = await setup();
    expect((await createCheckout(a.auth, [{ productId: rosa.id, quantity: 1 }])).status).toBe(403);
  });
});

describe("HU-12 Pago con tarjeta (pasarela sandbox + webhook firmado)", () => {
  it("al aprobarse el pago el pedido pasa a Pagado y el stock se descuenta", async () => {
    const { rosa, lirio, customer } = await setup();
    const { body: c } = await createCheckout(customer.auth, [{ productId: rosa.id, quantity: 10 }, { productId: lirio.id, quantity: 2 }]);

    const pay = await request(app).post("/api/sandbox-gateway/charges").set(customer.auth).send({ checkoutId: c.id, outcome: "approve" });
    expect(pay.body.status).toBe("paid");

    const stored = await prisma.checkout.findUniqueOrThrow({ where: { id: c.id }, include: { orders: { include: { events: true } } } });
    expect(stored.status).toBe("PAID");
    expect(stored.orders).toHaveLength(2);
    expect(stored.orders.every((o) => o.status === "PAID" && o.events.some((e) => e.status === "PAID"))).toBe(true);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: rosa.id } })).stock).toBe(40);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: lirio.id } })).stock).toBe(3);
  });

  it("si el pago es rechazado el pedido sigue Pendiente de pago y el stock no cambia", async () => {
    const { rosa, customer } = await setup();
    const { body: c } = await createCheckout(customer.auth, [{ productId: rosa.id, quantity: 5 }]);
    const pay = await request(app).post("/api/sandbox-gateway/charges").set(customer.auth).send({ checkoutId: c.id, outcome: "decline" });
    expect(pay.body.status).toBe("payment-failed");
    const stored = await prisma.checkout.findUniqueOrThrow({ where: { id: c.id } });
    expect(stored.status).toBe("PENDING_PAYMENT");
    expect(stored.failureReason).toContain("rechazada");
    expect((await prisma.product.findUniqueOrThrow({ where: { id: rosa.id } })).stock).toBe(50);
  });

  it("el webhook rechaza firmas inválidas con 401 y no modifica el pedido", async () => {
    const { rosa, customer } = await setup();
    const { body: c } = await createCheckout(customer.auth, [{ productId: rosa.id, quantity: 1 }]);
    const event = { type: "charge.succeeded", data: { chargeId: "chr_x", checkoutId: c.id, amountCents: 300, method: "CARD" } };
    expect((await webhook(event, "otra-clave-secreta-que-no-es-la-de-la-pasarela")).status).toBe(401);
    const noSig = await request(app).post("/api/payments/webhook").set("Content-Type", "application/json").send(JSON.stringify(event));
    expect(noSig.status).toBe(401);
    expect((await prisma.checkout.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("PENDING_PAYMENT");
  });

  it("con firma válida procesa el evento una sola vez (idempotente)", async () => {
    const { rosa, customer } = await setup();
    const { body: c } = await createCheckout(customer.auth, [{ productId: rosa.id, quantity: 4 }]);
    const event = { type: "charge.succeeded", data: { chargeId: "chr_1", checkoutId: c.id, amountCents: 1200, method: "CARD" } };
    expect((await webhook(event)).body.status).toBe("paid");
    expect((await webhook(event)).body.status).toBe("already-processed");
    expect((await prisma.product.findUniqueOrThrow({ where: { id: rosa.id } })).stock).toBe(46);
  });

  it("ignora pagos con monto distinto al total y compras inexistentes", async () => {
    const { rosa, customer } = await setup();
    const { body: c } = await createCheckout(customer.auth, [{ productId: rosa.id, quantity: 1 }]);
    expect((await webhook({ type: "charge.succeeded", data: { chargeId: "chr_2", checkoutId: c.id, amountCents: 1, method: "CARD" } })).body.status).toBe("amount-mismatch");
    expect((await webhook({ type: "charge.succeeded", data: { chargeId: "chr_3", checkoutId: "no-existe", amountCents: 1, method: "CARD" } })).body.status).toBe("ignored");
  });

  it("no vende la misma flor dos veces: si otro pago agotó el stock, la compra falla sin stock negativo", async () => {
    const { lirio, customer } = await setup();
    const other = await createUser("CUSTOMER");
    const { body: c1 } = await createCheckout(customer.auth, [{ productId: lirio.id, quantity: 5 }]);
    const { body: c2 } = await createCheckout(other.auth, [{ productId: lirio.id, quantity: 5 }]);
    await request(app).post("/api/sandbox-gateway/charges").set(customer.auth).send({ checkoutId: c1.id, outcome: "approve" });
    const second = await request(app).post("/api/sandbox-gateway/charges").set(other.auth).send({ checkoutId: c2.id, outcome: "approve" });
    expect(second.body.status).toBe("out-of-stock");
    expect((await prisma.product.findUniqueOrThrow({ where: { id: lirio.id } })).stock).toBe(0);
    expect((await prisma.checkout.findUniqueOrThrow({ where: { id: c2.id } })).status).toBe("FAILED");
  });

  it("un cliente no puede pagar ni ver la compra de otro", async () => {
    const { rosa, customer } = await setup();
    const intruder = await createUser("CUSTOMER");
    const { body: c } = await createCheckout(customer.auth, [{ productId: rosa.id, quantity: 1 }]);
    expect((await request(app).post("/api/sandbox-gateway/charges").set(intruder.auth).send({ checkoutId: c.id, outcome: "approve" })).status).toBe(404);
    expect((await request(app).get(`/api/checkout/${c.id}`).set(intruder.auth)).status).toBe(404);
    expect((await request(app).get(`/api/checkout/${c.id}`).set(customer.auth)).body.orders).toHaveLength(1);
  });

  it("verifica firmas en tiempo constante y rechaza formatos inválidos", () => {
    const raw = Buffer.from("{}");
    expect(verifySignature(raw, sign(raw, "s".repeat(32)), "s".repeat(32))).toBe(true);
    expect(verifySignature(raw, "zz", "s".repeat(32))).toBe(false);
    expect(verifySignature(raw, undefined, "s".repeat(32))).toBe(false);
  });
});

describe("HU-15 Pedidos del comerciante", () => {
  async function paidOrder(fulfillment: object = pickup) {
    const ctx = await setup();
    const { body: c } = await createCheckout(ctx.customer.auth, [{ productId: ctx.rosa.id, quantity: 2 }, { productId: ctx.lirio.id, quantity: 1 }], fulfillment);
    await request(app).post("/api/sandbox-gateway/charges").set(ctx.customer.auth).send({ checkoutId: c.id, outcome: "approve" });
    return ctx;
  }

  it("el comerciante solo ve los pedidos de su puesto, con detalle y contacto", async () => {
    const { a, b } = await paidOrder();
    const resA = await request(app).get("/api/merchant/orders").set(a.auth);
    const resB = await request(app).get("/api/merchant/orders").set(b.auth);
    expect(resA.body).toHaveLength(1);
    expect(resA.body[0].items.map((i: { name: string }) => i.name)).toEqual(["Rosa"]);
    expect(resA.body[0].checkout.phone).toBe("987654321");
    expect(resB.body[0].items.map((i: { name: string }) => i.name)).toEqual(["Lirio"]);
  });

  it("cambia el estado registrando fecha y hora en el historial", async () => {
    const { a } = await paidOrder({ fulfillment: "DELIVERY", district: "Rímac", address: "Jr. Trujillo 456", phone: "987654321" });
    const [order] = (await request(app).get("/api/merchant/orders").set(a.auth)).body;
    for (const status of ["PREPARING", "READY", "SHIPPED", "DELIVERED"]) {
      const res = await request(app).patch(`/api/merchant/orders/${order.id}/status`).set(a.auth).send({ status });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe(status);
    }
    const events = await prisma.orderEvent.findMany({ where: { orderId: order.id }, orderBy: { createdAt: "asc" } });
    expect(events.map((e) => e.status)).toEqual(["PENDING_PAYMENT", "PAID", "PREPARING", "READY", "SHIPPED", "DELIVERED"]);
    expect(events.every((e) => e.createdAt instanceof Date)).toBe(true);
  });

  it("rechaza transiciones inválidas", async () => {
    const { a } = await paidOrder();
    const [order] = (await request(app).get("/api/merchant/orders").set(a.auth)).body;
    const res = await request(app).patch(`/api/merchant/orders/${order.id}/status`).set(a.auth).send({ status: "SHIPPED" });
    expect(res.body.code).toBe("INVALID_TRANSITION");
  });

  it("un comerciante no puede cambiar pedidos de otro puesto (404)", async () => {
    const { a, b } = await paidOrder();
    const [orderB] = (await request(app).get("/api/merchant/orders").set(b.auth)).body;
    const res = await request(app).patch(`/api/merchant/orders/${orderB.id}/status`).set(a.auth).send({ status: "PREPARING" });
    expect(res.status).toBe(404);
  });

  it("no muestra pedidos aún no pagados", async () => {
    const ctx = await setup();
    await createCheckout(ctx.customer.auth, [{ productId: ctx.rosa.id, quantity: 1 }]);
    expect((await request(app).get("/api/merchant/orders").set(ctx.a.auth)).body).toEqual([]);
  });

  it("reglas de transición por modalidad", () => {
    expect(canTransition("READY", "DELIVERED", "PICKUP")).toBe(true);
    expect(canTransition("READY", "SHIPPED", "PICKUP")).toBe(false);
    expect(canTransition("READY", "DELIVERED", "DELIVERY")).toBe(false);
    expect(canTransition("PENDING_PAYMENT", "PREPARING", "PICKUP")).toBe(false);
  });
});
