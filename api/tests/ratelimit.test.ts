import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";

describe("Rate limiting global", () => {
  it("publica las cabeceras RateLimit en cada respuesta", async () => {
    const res = await request(createApp()).get("/health");
    expect(res.headers["ratelimit-policy"]).toBeDefined();
  });
});
