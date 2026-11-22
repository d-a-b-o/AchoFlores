import express, { Router } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import { config } from "../../config";
import { prisma } from "../../lib/prisma";
import { notFound, unauthorized } from "../../lib/errors";
import { securityEvent } from "../../lib/logger";
import { requireAuth } from "../../middleware/auth";
import { parse } from "../../middleware/validate";
import { processPaymentEvent, webhookEventSchema } from "./payments.service";
import { sign, verifySignature } from "./signature";

/**
 * Webhook de la pasarela. Se monta ANTES de express.json(): la firma se calcula sobre el cuerpo crudo.
 */
export const paymentsWebhookRouter = Router();
paymentsWebhookRouter.post("/", express.raw({ type: "application/json", limit: "20kb" }), async (req, res) => {
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from("");
  if (!verifySignature(raw, req.header("x-signature"), config.PAYMENT_WEBHOOK_SECRET)) {
    securityEvent("webhook_bad_signature", { ip: req.ip });
    throw unauthorized("Firma inválida");
  }
  let json: unknown;
  try {
    json = JSON.parse(raw.toString("utf8"));
  } catch {
    throw unauthorized("Cuerpo inválido");
  }
  res.json(await processPaymentEvent(parse(webhookEventSchema, json)));
});

/**
 * Pasarela de pago en modo sandbox (simulada) para el MVP académico.
 * No recibe datos de tarjeta: solo permite elegir el resultado de la prueba, como el
 * modo test de Culqi o Mercado Pago, y entrega el resultado firmado al mismo webhook.
 */
export const sandboxGatewayRouter = Router();
sandboxGatewayRouter.post("/charges", requireAuth, async (req, res) => {
  const { checkoutId, outcome } = parse(z.object({ checkoutId: z.string().min(1).max(40), outcome: z.enum(["approve", "decline"]) }), req.body);
  const checkout = await prisma.checkout.findFirst({ where: { id: checkoutId, customerId: req.user!.id } });
  if (!checkout) throw notFound("Compra no encontrada");

  const event = {
    type: outcome === "approve" ? "charge.succeeded" : "charge.failed",
    data: {
      chargeId: `chr_test_${crypto.randomBytes(8).toString("hex")}`,
      checkoutId,
      amountCents: checkout.totalCents,
      method: checkout.paymentMethod ?? "CARD",
      ...(outcome === "decline" && { failureMessage: "Tarjeta rechazada por el banco emisor (sandbox)" }),
    },
  };
  const body = JSON.stringify(event);
  // El evento pasa por la misma verificación de firma que usaría la pasarela real.
  const raw = Buffer.from(body);
  if (!verifySignature(raw, sign(raw, config.PAYMENT_WEBHOOK_SECRET), config.PAYMENT_WEBHOOK_SECRET)) throw unauthorized();
  const result = await processPaymentEvent(webhookEventSchema.parse(event));
  res.json({ ...result, chargeId: event.data.chargeId });
});
