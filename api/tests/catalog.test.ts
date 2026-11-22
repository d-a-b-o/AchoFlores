import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { createApprovedMerchant, createProduct } from "./helpers";

const app = createApp();

describe("HU-08 Catálogo público", () => {
  it("un visitante sin sesión ve solo productos activos de puestos aprobados, con su puesto", async () => {
    const a = await createApprovedMerchant();
    const b = await createApprovedMerchant();
    await prisma.stall.update({ where: { id: b.stall.id }, data: { status: "PENDING" } });
    await createProduct(a.stall.id, { name: "Girasoles" });
    await createProduct(a.stall.id, { name: "Inactivo", active: false });
    await createProduct(b.stall.id, { name: "De puesto pendiente" });

    const res = await request(app).get("/api/catalog/products");
    expect(res.status).toBe(200);
    expect(res.body.items.map((p: { name: string }) => p.name)).toEqual(["Girasoles"]);
    expect(res.body.items[0].stall).toMatchObject({ number: a.stall.number });
    expect(res.body.items[0].stall.documentNumber).toBeUndefined();
  });

  it("pagina de 20 en 20", async () => {
    const { stall } = await createApprovedMerchant();
    await prisma.product.createMany({
      data: Array.from({ length: 25 }, (_, i) => ({ stallId: stall.id, name: `Flor ${i}`, category: "rosas", priceCents: 1000, stock: 5, imageUrl: "x" })),
    });
    const p1 = await request(app).get("/api/catalog/products");
    const p2 = await request(app).get("/api/catalog/products?page=2");
    expect(p1.body).toMatchObject({ total: 25, pages: 2, pageSize: 20 });
    expect(p1.body.items).toHaveLength(20);
    expect(p2.body.items).toHaveLength(5);
  });
});

describe("HU-09 Búsqueda y filtros", () => {
  it("filtra por tipo de flor y rango de precio a la vez", async () => {
    const { stall } = await createApprovedMerchant();
    await createProduct(stall.id, { name: "Rosas baratas", category: "rosas", priceCents: 2500 });
    await createProduct(stall.id, { name: "Rosas premium", category: "rosas", priceCents: 9000 });
    await createProduct(stall.id, { name: "Girasoles", category: "girasoles", priceCents: 2000 });

    const res = await request(app).get("/api/catalog/products?category=rosas&minPrice=0&maxPrice=50");
    expect(res.body.items.map((p: { name: string }) => p.name)).toEqual(["Rosas baratas"]);
  });

  it("busca por texto sin distinguir mayúsculas y filtra por ocasión", async () => {
    const { stall } = await createApprovedMerchant();
    await createProduct(stall.id, { name: "Corona fúnebre", category: "coronas", occasion: "condolencias" });
    await createProduct(stall.id, { name: "Ramo para mamá", occasion: "dia-de-la-madre" });
    expect((await request(app).get("/api/catalog/products?q=CORONA")).body.items).toHaveLength(1);
    const res = await request(app).get("/api/catalog/products?occasion=dia-de-la-madre");
    expect(res.body.items[0].name).toBe("Ramo para mamá");
  });

  it("sin resultados devuelve lista vacía y sugerencias", async () => {
    const res = await request(app).get("/api/catalog/products?q=tulipanes-azules");
    expect(res.body.items).toEqual([]);
    expect(res.body.suggestions.length).toBeGreaterThan(0);
  });

  it("rechaza filtros inválidos", async () => {
    expect((await request(app).get("/api/catalog/products?category=cactus")).status).toBe(400);
  });
});

describe("HU-11 Perfil del puesto", () => {
  it("muestra datos públicos y productos activos de un puesto aprobado", async () => {
    const { stall } = await createApprovedMerchant();
    await createProduct(stall.id, { name: "Lirios" });
    await createProduct(stall.id, { name: "Oculto", active: false });
    const res = await request(app).get(`/api/catalog/stalls/${stall.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ number: stall.number, pavilion: "A", schedule: stall.schedule });
    expect(res.body.products.map((p: { name: string }) => p.name)).toEqual(["Lirios"]);
    expect(res.body.documentNumber).toBeUndefined();
  });

  it("responde 404 para un puesto no aprobado", async () => {
    const { stall } = await createApprovedMerchant();
    await prisma.stall.update({ where: { id: stall.id }, data: { status: "REJECTED" } });
    expect((await request(app).get(`/api/catalog/stalls/${stall.id}`)).status).toBe(404);
  });
});
