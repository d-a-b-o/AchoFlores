import path from "node:path";
import fs from "node:fs";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import { config } from "./config";
import { logger } from "./lib/logger";
import { errorHandler, notFoundHandler } from "./middleware/error";
import { apiRouter } from "./routes";
import { paymentsWebhookRouter } from "./modules/payments/payments.routes";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1); // Render/Vercel están detrás de un proxy

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          connectSrc: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );
  if (config.CORS_ORIGIN) {
    app.use(cors({ origin: config.CORS_ORIGIN.split(","), credentials: false }));
  }
  app.use(pinoHttp({ logger, autoLogging: !config.isTest }));
  // Límite global por IP (mitiga abuso y DoS de aplicación); login y pagos tienen uno más estricto.
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: config.isTest ? 10_000 : 300,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: { error: "Demasiadas solicitudes. Intenta en un minuto.", code: "RATE_LIMITED" },
    }),
  );
  // El webhook necesita el cuerpo crudo para verificar la firma HMAC: va antes del parser JSON.
  app.use("/api/payments/webhook", paymentsWebhookRouter);
  app.use(express.json({ limit: "100kb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "achoflores-api", version: process.env.npm_package_version ?? "0.1.0" });
  });

  app.use("/api", apiRouter);
  app.use("/api", notFoundHandler);

  // En producción la misma imagen sirve la PWA compilada (web/dist).
  const webDist = config.WEB_DIST ?? path.resolve(__dirname, "../../web/dist");
  // La ruta viene de la configuración del servidor, no de la entrada del usuario.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  if (fs.existsSync(webDist)) {
    app.use(express.static(webDist, { index: false, maxAge: "1h" }));
    app.get(/^\/(?!api|health).*/, (_req, res) => res.sendFile(path.join(webDist, "index.html")));
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
