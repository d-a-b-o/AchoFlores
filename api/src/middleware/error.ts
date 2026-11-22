import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import multer from "multer";
import { HttpError } from "../lib/errors";
import { logger } from "../lib/logger";

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "Ruta no encontrada", code: "NOT_FOUND" });
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Datos inválidos",
      code: "VALIDATION_ERROR",
      details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
    return;
  }
  if (err instanceof multer.MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE" ? "La imagen supera 5 MB" : "Archivo inválido";
    res.status(400).json({ error: message, code: err.code });
    return;
  }
  if (err?.type === "entity.parse.failed") {
    res.status(400).json({ error: "JSON inválido", code: "BAD_JSON" });
    return;
  }
  logger.error({ err, path: req.path }, "Error no controlado");
  // No se exponen detalles internos al cliente.
  res.status(500).json({ error: "Error interno", code: "INTERNAL" });
};
