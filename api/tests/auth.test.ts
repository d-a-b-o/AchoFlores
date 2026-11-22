import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { createUser } from "./helpers";

const app = createApp();
const valid = {
  email: "Cliente@Correo.pe",
  password: "rosas2026",
  name: "Ana Cliente",
  acceptPrivacy: true,
};

describe("HU-01 Registro de cliente", () => {
  it("crea la cuenta con rol cliente, normaliza el correo y no guarda la contraseña en claro", async () => {
    const res = await request(app).post("/api/auth/register").send(valid);
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: "cliente@correo.pe", role: "CUSTOMER" });
    expect(res.body.token).toBeTypeOf("string");
    expect(res.body.user.passwordHash).toBeUndefined();

    const stored = await prisma.user.findUniqueOrThrow({ where: { email: "cliente@correo.pe" } });
    expect(stored.passwordHash).not.toContain("rosas2026");
    expect(stored.consentAt).toBeInstanceOf(Date);
  });

  it("rechaza un correo ya registrado", async () => {
    await request(app).post("/api/auth/register").send(valid);
    const res = await request(app).post("/api/auth/register").send(valid);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("Este correo ya tiene una cuenta");
  });

  it.each([
    ["sin número", "rosasrosas"],
    ["menos de 8 caracteres", "ros4"],
  ])("rechaza contraseña %s", async (_c, password) => {
    const res = await request(app).post("/api/auth/register").send({ ...valid, password });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("rechaza el registro si no acepta la política de datos (Ley 29733)", async () => {
    const res = await request(app).post("/api/auth/register").send({ ...valid, acceptPrivacy: false });
    expect(res.status).toBe(400);
  });

  it("no permite autoregistrarse como administrador", async () => {
    const res = await request(app).post("/api/auth/register").send({ ...valid, accountType: "ADMIN" });
    expect(res.status).toBe(400);
  });

  it("permite registrarse como comerciante", async () => {
    const res = await request(app).post("/api/auth/register").send({ ...valid, accountType: "MERCHANT" });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("MERCHANT");
  });
});

describe("HU-02 Inicio de sesión", () => {
  it("con credenciales correctas devuelve token y el rol del usuario", async () => {
    const { user } = await createUser("MERCHANT");
    const res = await request(app).post("/api/auth/login").send({ email: user.email, password: "secreto123" });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("MERCHANT");

    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${res.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.email).toBe(user.email);
  });

  it("usa un mensaje genérico que no revela si el correo existe", async () => {
    const { user } = await createUser();
    const wrongPass = await request(app).post("/api/auth/login").send({ email: user.email, password: "otra1234" });
    const unknown = await request(app).post("/api/auth/login").send({ email: "nadie@x.pe", password: "otra1234" });
    expect(wrongPass.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrongPass.body.error).toBe(unknown.body.error);
  });

  it("bloquea la cuenta 15 minutos tras 5 intentos fallidos seguidos", async () => {
    const { user } = await createUser();
    for (let i = 0; i < 5; i++) {
      await request(app).post("/api/auth/login").send({ email: user.email, password: "mala12345" });
    }
    const res = await request(app).post("/api/auth/login").send({ email: user.email, password: "secreto123" });
    expect(res.status).toBe(423);
    expect(res.body.code).toBe("ACCOUNT_LOCKED");

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const minutes = (stored.lockedUntil!.getTime() - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(14);
    expect(minutes).toBeLessThanOrEqual(15);
  });

  it("reinicia el contador de fallos después de un login correcto", async () => {
    const { user } = await createUser();
    for (let i = 0; i < 3; i++) {
      await request(app).post("/api/auth/login").send({ email: user.email, password: "mala12345" });
    }
    await request(app).post("/api/auth/login").send({ email: user.email, password: "secreto123" });
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.failedLogins).toBe(0);
  });

  it("rechaza tokens inválidos o ausentes", async () => {
    expect((await request(app).get("/api/auth/me")).status).toBe(401);
    const res = await request(app).get("/api/auth/me").set("Authorization", "Bearer token-falso");
    expect(res.status).toBe(401);
  });
});
