import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { createUser } from "./helpers";

const app = createApp();
const stall = {
  name: "Flores Doña Rosa",
  number: "b-12",
  pavilion: "B",
  schedule: "Lun-Dom 5:00-17:00",
  documentType: "DNI",
  documentNumber: "45678912",
};

describe("HU-03 Registro de puesto", () => {
  it("el comerciante registra su puesto y queda pendiente de aprobación", async () => {
    const { auth } = await createUser("MERCHANT");
    const res = await request(app).post("/api/stalls").set(auth).send(stall);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ number: "B-12", status: "PENDING" });

    const mine = await request(app).get("/api/stalls/me").set(auth);
    expect(mine.body.status).toBe("PENDING");
  });

  it("rechaza un número de puesto ya registrado", async () => {
    await request(app).post("/api/stalls").set((await createUser("MERCHANT")).auth).send(stall);
    const res = await request(app).post("/api/stalls").set((await createUser("MERCHANT")).auth).send(stall);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("STALL_NUMBER_TAKEN");
  });

  it("no permite registrar dos puestos con la misma cuenta", async () => {
    const { auth } = await createUser("MERCHANT");
    await request(app).post("/api/stalls").set(auth).send(stall);
    const res = await request(app).post("/api/stalls").set(auth).send({ ...stall, number: "C-1" });
    expect(res.body.code).toBe("STALL_EXISTS");
  });

  it.each([
    ["DNI", "1234567"],
    ["RUC", "30123456789"],
  ])("valida el documento %s %s", async (documentType, documentNumber) => {
    const { auth } = await createUser("MERCHANT");
    const res = await request(app).post("/api/stalls").set(auth).send({ ...stall, documentType, documentNumber });
    expect(res.status).toBe(400);
  });

  it("acepta un RUC válido", async () => {
    const { auth } = await createUser("MERCHANT");
    const res = await request(app).post("/api/stalls").set(auth).send({ ...stall, documentType: "RUC", documentNumber: "20123456789" });
    expect(res.status).toBe(201);
  });

  it("un cliente no puede registrar puestos (RBAC)", async () => {
    const res = await request(app).post("/api/stalls").set((await createUser("CUSTOMER")).auth).send(stall);
    expect(res.status).toBe(403);
  });

  it("devuelve 404 si el comerciante aún no tiene puesto", async () => {
    const res = await request(app).get("/api/stalls/me").set((await createUser("MERCHANT")).auth);
    expect(res.status).toBe(404);
  });
});

describe("HU-04 Aprobación de puestos", () => {
  async function pendingStall() {
    const merchant = await createUser("MERCHANT");
    const res = await request(app).post("/api/stalls").set(merchant.auth).send({ ...stall, number: `P-${Date.now() % 100000}` });
    return { merchant, stallId: res.body.id as string };
  }

  it("el administrador lista los pendientes y aprueba un puesto", async () => {
    const admin = await createUser("ADMIN");
    const { stallId } = await pendingStall();

    const list = await request(app).get("/api/admin/stalls").set(admin.auth);
    expect(list.body.map((s: { id: string }) => s.id)).toContain(stallId);

    const res = await request(app).post(`/api/admin/stalls/${stallId}/approve`).set(admin.auth);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("APPROVED");
    expect(res.body.reviewedAt).toBeTruthy();
  });

  it("al rechazar exige un motivo y lo guarda para el comerciante", async () => {
    const admin = await createUser("ADMIN");
    const { stallId, merchant } = await pendingStall();

    const noReason = await request(app).post(`/api/admin/stalls/${stallId}/reject`).set(admin.auth).send({});
    expect(noReason.status).toBe(400);

    const res = await request(app)
      .post(`/api/admin/stalls/${stallId}/reject`)
      .set(admin.auth)
      .send({ reason: "El DNI no coincide con el padrón del mercado" });
    expect(res.body.status).toBe("REJECTED");

    const mine = await request(app).get("/api/stalls/me").set(merchant.auth);
    expect(mine.body.rejectionReason).toContain("DNI");
  });

  it("no permite revisar dos veces el mismo puesto", async () => {
    const admin = await createUser("ADMIN");
    const { stallId } = await pendingStall();
    await request(app).post(`/api/admin/stalls/${stallId}/approve`).set(admin.auth);
    const again = await request(app).post(`/api/admin/stalls/${stallId}/approve`).set(admin.auth);
    expect(again.status).toBe(400);
  });

  it("solo el administrador puede aprobar (403 para comerciantes)", async () => {
    const { stallId, merchant } = await pendingStall();
    const res = await request(app).post(`/api/admin/stalls/${stallId}/approve`).set(merchant.auth);
    expect(res.status).toBe(403);
    const stored = await prisma.stall.findUniqueOrThrow({ where: { id: stallId } });
    expect(stored.status).toBe("PENDING");
  });

  it("devuelve 404 para un puesto inexistente", async () => {
    const admin = await createUser("ADMIN");
    const res = await request(app).post(`/api/admin/stalls/no-existe/approve`).set(admin.auth);
    expect(res.status).toBe(404);
  });
});
