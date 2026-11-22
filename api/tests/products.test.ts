import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { detectImageType } from "../src/lib/image";
import { createApprovedMerchant, createUser, PNG_1PX } from "./helpers";

const app = createApp();

function publish(auth: Record<string, string>, overrides: Record<string, string> = {}, image: Buffer | null = PNG_1PX) {
  const fields = { name: "Docena de rosas rojas", category: "rosas", occasion: "san-valentin", price: "35.50", stock: "40", ...overrides };
  const req = request(app).post("/api/products").set(auth);
  for (const [k, v] of Object.entries(fields)) req.field(k, v);
  if (image) req.attach("image", image, "rosas.png");
  return req;
}

describe("HU-05 Publicar producto", () => {
  it("un comerciante aprobado publica un producto con foto, precio y stock", async () => {
    const { auth } = await createApprovedMerchant();
    const res = await publish(auth);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: "Docena de rosas rojas", price: 35.5, priceCents: 3550, stock: 40, active: true });

    const img = await request(app).get(res.body.imageUrl);
    expect(img.status).toBe(200);
    expect(img.headers["content-type"]).toBe("image/png");

    const mine = await request(app).get("/api/products/mine").set(auth);
    expect(mine.body).toHaveLength(1);
  });

  it("rechaza un archivo que no es imagen aunque tenga extensión .png", async () => {
    const { auth } = await createApprovedMerchant();
    const res = await publish(auth, {}, Buffer.from("<?php echo 'hola'; ?>"));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_IMAGE");
  });

  it("rechaza imágenes de más de 5 MB", async () => {
    const { auth } = await createApprovedMerchant();
    const big = Buffer.concat([PNG_1PX, Buffer.alloc(5 * 1024 * 1024)]);
    const res = await publish(auth, {}, big);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("5 MB");
  });

  it("exige foto y precio mayor a 0", async () => {
    const { auth } = await createApprovedMerchant();
    expect((await publish(auth, {}, null)).body.code).toBe("IMAGE_REQUIRED");
    expect((await publish(auth, { price: "0" })).status).toBe(400);
  });

  it("un comerciante con puesto pendiente no puede publicar", async () => {
    const { auth, stall } = await createApprovedMerchant();
    await prisma.stall.update({ where: { id: stall.id }, data: { status: "PENDING" } });
    const res = await publish(auth);
    expect(res.status).toBe(403);
  });

  it("un comerciante sin puesto o un cliente no pueden publicar", async () => {
    expect((await publish((await createUser("MERCHANT")).auth)).status).toBe(403);
    expect((await publish((await createUser("CUSTOMER")).auth)).status).toBe(403);
  });

  it("expone las categorías y ocasiones disponibles", async () => {
    const res = await request(app).get("/api/products/meta");
    expect(res.body.categories).toContain("rosas");
    expect(res.body.occasions).toContain("dia-de-la-madre");
  });
});

describe("HU-06 Editar y desactivar productos", () => {
  it("actualiza precio y stock, y permite desactivar el producto", async () => {
    const { auth } = await createApprovedMerchant();
    const { body: p } = await publish(auth);

    const res = await request(app).patch(`/api/products/${p.id}`).set(auth).field("price", "30").field("stock", "0");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ priceCents: 3000, stock: 0 });

    const off = await request(app).patch(`/api/products/${p.id}`).set(auth).field("active", "false");
    expect(off.body.active).toBe(false);
  });

  it("permite reemplazar la foto", async () => {
    const { auth } = await createApprovedMerchant();
    const { body: p } = await publish(auth);
    const res = await request(app).patch(`/api/products/${p.id}`).set(auth).attach("image", PNG_1PX, "nueva.png");
    expect(res.body.imageUrl).not.toBe(p.imageUrl);
  });

  it("un comerciante no puede editar productos de otro puesto", async () => {
    const owner = await createApprovedMerchant();
    const other = await createApprovedMerchant();
    const { body: p } = await publish(owner.auth);
    const res = await request(app).patch(`/api/products/${p.id}`).set(other.auth).field("stock", "999");
    expect(res.status).toBe(403);
    const stored = await prisma.product.findUniqueOrThrow({ where: { id: p.id } });
    expect(stored.stock).toBe(40);
  });

  it("devuelve 404 para un producto inexistente", async () => {
    const { auth } = await createApprovedMerchant();
    const res = await request(app).patch(`/api/products/no-existe`).set(auth).field("stock", "1");
    expect(res.status).toBe(404);
  });
});

describe("Validación de imágenes por magic bytes", () => {
  it("reconoce JPEG, PNG y WebP y rechaza otros formatos", () => {
    expect(detectImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(detectImageType(PNG_1PX)).toBe("image/png");
    expect(detectImageType(Buffer.from("RIFF0000WEBPVP8 "))).toBe("image/webp");
    expect(detectImageType(Buffer.from("GIF89a"))).toBeNull();
  });
});
