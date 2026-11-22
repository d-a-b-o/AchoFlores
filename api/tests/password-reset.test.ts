import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { outbox } from "../src/lib/mailer";
import { createUser } from "./helpers";

const app = createApp();
const tokenFromMail = () => /token=([\w-]+)/.exec(outbox.at(-1)!.text)![1];

beforeEach(() => {
  outbox.length = 0;
});

describe("HU-21 Recuperar contraseña", () => {
  it("envía un enlace de un solo uso que permite cambiar la contraseña", async () => {
    const { user } = await createUser();
    const res = await request(app).post("/api/auth/forgot-password").send({ email: user.email });
    expect(res.status).toBe(202);
    expect(outbox).toHaveLength(1);
    expect(outbox[0].to).toBe(user.email);
    const token = tokenFromMail();

    const stored = await prisma.passwordReset.findFirstOrThrow({ where: { userId: user.id } });
    expect(stored.tokenHash).not.toBe(token); // se guarda solo el hash
    const minutes = (stored.expiresAt.getTime() - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(29);
    expect(minutes).toBeLessThanOrEqual(30);

    const reset = await request(app).post("/api/auth/reset-password").send({ token, password: "nueva2026" });
    expect(reset.status).toBe(200);
    const login = await request(app).post("/api/auth/login").send({ email: user.email, password: "nueva2026" });
    expect(login.status).toBe(200);

    const again = await request(app).post("/api/auth/reset-password").send({ token, password: "otra20266" });
    expect(again.body.code).toBe("INVALID_RESET_TOKEN");
  });

  it("responde lo mismo para correos no registrados y no envía nada", async () => {
    const res = await request(app).post("/api/auth/forgot-password").send({ email: "nadie@acho.pe" });
    expect(res.status).toBe(202);
    expect(outbox).toHaveLength(0);
  });

  it("rechaza un enlace vencido", async () => {
    const { user } = await createUser();
    await request(app).post("/api/auth/forgot-password").send({ email: user.email });
    await prisma.passwordReset.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    const res = await request(app).post("/api/auth/reset-password").send({ token: tokenFromMail(), password: "nueva2026" });
    expect(res.status).toBe(400);
  });

  it("exige que la nueva contraseña cumpla la política", async () => {
    const res = await request(app).post("/api/auth/reset-password").send({ token: "x".repeat(43), password: "corta" });
    expect(res.status).toBe(400);
  });
});
