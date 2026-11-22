import pino from "pino";
import { config } from "../config";

export const logger = pino({
  level: config.isTest ? "silent" : config.LOG_LEVEL,
  redact: ["req.headers.authorization", "req.headers.cookie", "*.password", "*.passwordHash"],
});

/** Eventos de seguridad (logins fallidos, bloqueos, cambios de estado) para la fase Monitor. */
export const securityEvent = (event: string, data: Record<string, unknown>) =>
  logger.warn({ securityEvent: event, ...data }, `security:${event}`);
