import { config } from "../config";
import { logger } from "./logger";

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

/** Bandeja en memoria para pruebas automatizadas. */
export const outbox: Mail[] = [];

/**
 * Envía correos transaccionales con Resend si RESEND_API_KEY está configurada.
 * Sin clave (desarrollo, pruebas o demo académica) el correo se registra sin su contenido.
 */
export async function sendMail(mail: Mail): Promise<void> {
  if (config.isTest) {
    outbox.push(mail);
    return;
  }
  if (!config.RESEND_API_KEY) {
    logger.info({ to: mail.to, subject: mail.subject }, "Correo simulado (RESEND_API_KEY no configurada)");
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: config.MAIL_FROM, to: mail.to, subject: mail.subject, text: mail.text }),
  });
  if (!res.ok) logger.error({ status: res.status }, "Fallo al enviar correo");
}
