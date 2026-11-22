import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { unitPriceCents } from "../src/lib/pricing";
import { createApprovedMerchant, createProduct, PNG_1PX } from "./helpers";

const app = createApp();

describe("HU-07 Precio por mayor", () => {
  it("aplica el precio por mayor al alcanzar la cantidad mínima", () => {
    const p = { priceCents: 300, wholesalePriceCents: 250, wholesaleMinQty: 12 };
    expect(unitPriceCents(p, 11)).toBe(300);
    expect(unitPriceCents(p, 12)).toBe(250);
    expect(unitPriceCents({ ...p, wholesalePriceCents: null, wholesaleMinQty: null }, 100)).toBe(300);
  });

  it("el comerciante define precio por mayor y cantidad mínima al publicar", async () => {
    const { auth } = await createApprovedMerchant();
    const res = await request(app)
      .post("/api/products")
      .set(auth)
      .field("name", "Rosa por unidad")
      .field("category", "rosas")
      .field("price", "3")
      .field("stock", "200")
      .field("wholesalePrice", "2.5")
      .field("wholesaleMinQty", "12")
      .attach("image", PNG_1PX, "r.png");
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ wholesalePriceCents: 250, wholesaleMinQty: 12, wholesalePrice: 2.5 });
  });

  it("rechaza un precio por mayor mayor o igual al unitario, o sin cantidad mínima", async () => {
    const { auth } = await createApprovedMerchant();
    const send = (fields: Record<string, string>) => {
      const r = request(app).post("/api/products").set(auth);
      for (const [k, v] of Object.entries({ name: "Rosa", category: "rosas", price: "3", stock: "10", ...fields })) r.field(k, v);
      return r.attach("image", PNG_1PX, "r.png");
    };
    expect((await send({ wholesalePrice: "3", wholesaleMinQty: "12" })).status).toBe(400);
    expect((await send({ wholesalePrice: "2" })).status).toBe(400);
  });

  it("al editar valida que el precio por mayor siga siendo menor al unitario", async () => {
    const { auth, stall } = await createApprovedMerchant();
    const p = await createProduct(stall.id, { priceCents: 300, wholesalePriceCents: 250, wholesaleMinQty: 12 });
    const res = await request(app).patch(`/api/products/${p.id}`).set(auth).field("price", "2");
    expect(res.body.code).toBe("INVALID_WHOLESALE");
  });
});

describe("HU-10 Carrito multivendedor", () => {
  it("agrupa por puesto con subtotales y total, y aplica precio por mayor", async () => {
    const a = await createApprovedMerchant();
    const b = await createApprovedMerchant();
    const rosa = await createProduct(a.stall.id, { name: "Rosa", priceCents: 300, wholesalePriceCents: 250, wholesaleMinQty: 12, stock: 100 });
    const lirio = await createProduct(b.stall.id, { name: "Lirio", priceCents: 1500, stock: 10 });

    const res = await request(app)
      .post("/api/cart/quote")
      .send({ items: [{ productId: rosa.id, quantity: 24 }, { productId: lirio.id, quantity: 2 }] });
    expect(res.status).toBe(200);
    expect(res.body.stalls).toHaveLength(2);
    const ga = res.body.stalls.find((g: { stall: { id: string } }) => g.stall.id === a.stall.id);
    expect(ga.lines[0]).toMatchObject({ unitPriceCents: 250, wholesaleApplied: true, lineTotalCents: 6000 });
    expect(ga.subtotalCents).toBe(6000);
    expect(res.body.totalCents).toBe(6000 + 3000);
  });

  it("limita la cantidad al stock disponible y avisa", async () => {
    const { stall } = await createApprovedMerchant();
    const p = await createProduct(stall.id, { name: "Tulipán", stock: 3 });
    const res = await request(app).post("/api/cart/quote").send({ items: [{ productId: p.id, quantity: 10 }] });
    expect(res.body.stalls[0].lines[0]).toMatchObject({ quantity: 3, requested: 10 });
    expect(res.body.warnings[0]).toContain("solo hay 3");
  });

  it("excluye productos agotados, desactivados o inexistentes (HU-06)", async () => {
    const { stall } = await createApprovedMerchant();
    const agotado = await createProduct(stall.id, { name: "Agotado", stock: 0 });
    const off = await createProduct(stall.id, { name: "Off", active: false });
    const res = await request(app)
      .post("/api/cart/quote")
      .send({ items: [{ productId: agotado.id, quantity: 1 }, { productId: off.id, quantity: 1 }, { productId: "nada", quantity: 1 }] });
    expect(res.body.stalls).toEqual([]);
    expect(res.body.totalCents).toBe(0);
    expect(res.body.warnings).toHaveLength(3);
  });

  it("valida la entrada del carrito", async () => {
    const res = await request(app).post("/api/cart/quote").send({ items: [{ productId: "x", quantity: 0 }] });
    expect(res.status).toBe(400);
  });
});
