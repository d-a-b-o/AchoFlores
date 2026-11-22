import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { outbox } from "../src/lib/mailer";
import { daysFromToday } from "../src/modules/orders/checkout.routes";
import { createApprovedMerchant, createProduct, createUser } from "./helpers";

const app = createApp();
const pickup = { fulfillment: "PICKUP", phone: "987654321" };
const isoInDays = (n: number) => new Date(Date.now() - 5 * 3_600_000 + n * 86_400_000).toISOString().slice(0, 10);

async function setup() {
  const a = await createApprovedMerchant();
  const b = await createApprovedMerchant();
  const rosa = await createProduct(a.stall.id, { name: "Rosa", priceCents: 300, stock: 100 });
  const lirio = await createProduct(b.stall.id, { name: "Lirio", priceCents: 1500, stock: 10 });
  const customer = await createUser("CUSTOMER");
  return { a, b, rosa, lirio, customer };
}

async function buy(auth: Record<string, string>, items: { productId: string; quantity: number }[], extra: object = pickup, outcome = "approve") {
  const { body: c } = await request(app).post("/api/checkout").set(auth).send({ items, ...extra });
  await request(app).post("/api/sandbox-gateway/charges").set(auth).send({ checkoutId: c.id, outcome });
  return c as { id: string };
}

beforeEach(() => {
  outbox.length = 0;
});

describe("HU-13 Correo de confirmación", () => {
  it("al confirmarse el pago el cliente recibe número de pedido, detalle y total", async () => {
    const { rosa, lirio, customer } = await setup();
    const c = await buy(customer.auth, [{ productId: rosa.id, quantity: 10 }, { productId: lirio.id, quantity: 1 }]);
    const mail = outbox.find((m) => m.to === customer.user.email)!;
    expect(mail.subject).toContain(c.id.slice(-8).toUpperCase());
    expect(mail.text).toContain("10 × Rosa");
    expect(mail.text).toContain("1 × Lirio");
    expect(mail.text).toContain("Total pagado: S/ 45.00");
  });

  it("no envía correo si el pago es rechazado", async () => {
    const { rosa, customer } = await setup();
    await buy(customer.auth, [{ productId: rosa.id, quantity: 1 }], pickup, "decline");
    expect(outbox).toHaveLength(0);
  });
});

describe("HU-16 Pago con Yape o Plin", () => {
  it.each(["YAPE", "PLIN"])("un pago con %s pasa a Pagado igual que con tarjeta", async (method) => {
    const { rosa, customer } = await setup();
    const c = await buy(customer.auth, [{ productId: rosa.id, quantity: 2 }], { ...pickup, paymentMethod: method });
    const stored = await prisma.checkout.findUniqueOrThrow({ where: { id: c.id } });
    expect(stored).toMatchObject({ status: "PAID", paymentMethod: method });
  });

  it("si el pago con billetera no se confirma, el pedido sigue Pendiente de pago", async () => {
    const { rosa, customer } = await setup();
    const { body: c } = await request(app).post("/api/checkout").set(customer.auth).send({ items: [{ productId: rosa.id, quantity: 1 }], ...pickup, paymentMethod: "YAPE" });
    expect((await prisma.checkout.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("PENDING_PAYMENT");
  });
});

describe("HU-17 Seguimiento del pedido", () => {
  it("«Mis pedidos» muestra el estado actual y el historial cuando cambia", async () => {
    const { a, rosa, customer } = await setup();
    await buy(customer.auth, [{ productId: rosa.id, quantity: 3 }]);
    const [order] = (await request(app).get("/api/merchant/orders").set(a.auth)).body;
    await request(app).patch(`/api/merchant/orders/${order.id}/status`).set(a.auth).send({ status: "PREPARING" });

    const res = await request(app).get("/api/orders").set(customer.auth);
    expect(res.status).toBe(200);
    const o = res.body[0].orders[0];
    expect(o.status).toBe("PREPARING");
    expect(o.events.map((e: { status: string }) => e.status)).toEqual(["PENDING_PAYMENT", "PAID", "PREPARING"]);
  });

  it("un cliente solo ve sus propias compras", async () => {
    const { rosa, customer } = await setup();
    await buy(customer.auth, [{ productId: rosa.id, quantity: 1 }]);
    const other = await createUser("CUSTOMER");
    expect((await request(app).get("/api/orders").set(other.auth)).body).toEqual([]);
  });
});

describe("HU-18 Pedidos programados", () => {
  it("programa la entrega y el comerciante lo ve en su agenda de esa fecha", async () => {
    const { a, rosa, customer } = await setup();
    const date = isoInDays(7);
    const c = await buy(customer.auth, [{ productId: rosa.id, quantity: 24 }], { ...pickup, scheduledFor: date });
    const stored = await prisma.checkout.findUniqueOrThrow({ where: { id: c.id } });
    expect(stored.scheduledFor?.toISOString().slice(0, 10)).toBe(date);

    const agenda = await request(app).get(`/api/merchant/orders?date=${date}`).set(a.auth);
    expect(agenda.body).toHaveLength(1);
    expect(agenda.body[0].checkout.scheduledFor).toBeTruthy();
    expect((await request(app).get(`/api/merchant/orders?date=${isoInDays(8)}`).set(a.auth)).body).toHaveLength(0);
  });

  it.each([0, 31, -2])("rechaza fechas fuera del rango de 1 a 30 días (%i)", async (n) => {
    const { rosa, customer } = await setup();
    const res = await request(app).post("/api/checkout").set(customer.auth).send({ items: [{ productId: rosa.id, quantity: 1 }], ...pickup, scheduledFor: isoInDays(n) });
    expect(res.status).toBe(400);
  });

  it("calcula los días según la fecha de Lima", () => {
    const now = new Date("2026-05-01T03:00:00Z"); // 30 abr 22:00 en Lima
    expect(daysFromToday("2026-05-01", now)).toBe(1);
  });
});

describe("HU-19 Notificación de pedido nuevo", () => {
  it("cada comerciante recibe aviso en el panel y correo al pagarse un pedido de su puesto", async () => {
    const { a, b, rosa, lirio, customer } = await setup();
    await buy(customer.auth, [{ productId: rosa.id, quantity: 2 }, { productId: lirio.id, quantity: 1 }]);

    const na = await request(app).get("/api/notifications").set(a.auth);
    expect(na.body.unread).toBe(1);
    expect(na.body.items[0].body).toContain("2 × Rosa");
    expect(outbox.some((m) => m.to === b.user.email && m.subject.includes("Nuevo pedido"))).toBe(true);

    await request(app).post(`/api/notifications/${na.body.items[0].id}/read`).set(a.auth).expect(204);
    expect((await request(app).get("/api/notifications").set(a.auth)).body.unread).toBe(0);
  });

  it("no permite marcar notificaciones de otro usuario", async () => {
    const { a, rosa, customer } = await setup();
    await buy(customer.auth, [{ productId: rosa.id, quantity: 1 }]);
    const [n] = (await request(app).get("/api/notifications").set(a.auth)).body.items;
    expect((await request(app).post(`/api/notifications/${n.id}/read`).set(customer.auth)).status).toBe(404);
  });
});

describe("HU-20 Panel de ventas del comerciante", () => {
  it("muestra ventas, número de pedidos y productos más vendidos de 7 y 30 días", async () => {
    const { a, rosa, customer } = await setup();
    const tulipan = await createProduct(a.stall.id, { name: "Tulipán", priceCents: 500, stock: 20 });
    await buy(customer.auth, [{ productId: rosa.id, quantity: 10 }, { productId: tulipan.id, quantity: 2 }]);
    await buy(customer.auth, [{ productId: rosa.id, quantity: 5 }]);
    await buy(customer.auth, [{ productId: rosa.id, quantity: 50 }], pickup, "decline"); // no cuenta

    const old = await prisma.order.findFirstOrThrow({ where: { stallId: a.stall.id, status: "PAID" }, orderBy: { createdAt: "asc" } });
    await prisma.order.update({ where: { id: old.id }, data: { createdAt: new Date(Date.now() - 10 * 86_400_000) } });

    const res = await request(app).get("/api/merchant/dashboard").set(a.auth);
    expect(res.body.last30).toMatchObject({ orders: 2, salesCents: 3000 + 1000 + 1500 });
    expect(res.body.last7).toMatchObject({ orders: 1, salesCents: 1500 });
    expect(res.body.last30.topProducts[0]).toMatchObject({ name: "Rosa", quantity: 15 });
    expect(res.body.last30.byDay.length).toBeGreaterThan(0);
  });

  it("sin ventas devuelve indicadores en cero; solo para comerciantes aprobados", async () => {
    const m = await createApprovedMerchant();
    expect((await request(app).get("/api/merchant/dashboard").set(m.auth)).body.last7).toMatchObject({ orders: 0, salesCents: 0, topProducts: [] });
    expect((await request(app).get("/api/merchant/dashboard").set((await createUser("MERCHANT")).auth)).status).toBe(403);
  });
});
