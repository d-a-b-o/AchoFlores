import crypto from "node:crypto";

/** Firma HMAC-SHA256 del cuerpo crudo del webhook (mismo esquema que usan las pasarelas). */
export const sign = (rawBody: string | Buffer, secret: string) => crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

export function verifySignature(rawBody: Buffer, signature: string | undefined, secret: string): boolean {
  if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = Buffer.from(sign(rawBody, secret), "hex");
  const given = Buffer.from(signature, "hex");
  // Comparación en tiempo constante para no filtrar la firma por tiempos de respuesta.
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}
