import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { z } from "zod";
import { errorHandler } from "../src/middleware/error";
import { badRequest, conflict, forbidden, notFound, unauthorized } from "../src/lib/errors";

function appThrowing(err: unknown) {
  const app = express();
  app.use(express.json());
  app.post("/x", () => {
    throw err;
  });
  app.use(errorHandler);
  return app;
}

describe("Manejo centralizado de errores", () => {
  it.each([
    [badRequest("a"), 400],
    [unauthorized(), 401],
    [forbidden(), 403],
    [notFound(), 404],
    [conflict("b"), 409],
  ])("traduce HttpError a su código HTTP", async (err, status) => {
    const res = await request(appThrowing(err)).post("/x");
    expect(res.status).toBe(status);
  });

  it("traduce errores de validación zod a 400 con detalle", async () => {
    const zerr = z.object({ n: z.number() }).safeParse({ n: "x" }).error;
    const res = await request(appThrowing(zerr)).post("/x");
    expect(res.status).toBe(400);
    expect(res.body.details[0].path).toBe("n");
  });

  it("responde 400 ante JSON malformado", async () => {
    const res = await request(appThrowing(new Error("no llega"))).post("/x").set("Content-Type", "application/json").send("{mal");
    expect(res.body.code).toBe("BAD_JSON");
  });

  it("no expone detalles internos en errores 500", async () => {
    const res = await request(appThrowing(new Error("conexión a BD con clave secreta"))).post("/x");
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain("secreta");
  });
});
