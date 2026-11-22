import { createApp } from "./app";
import { config } from "./config";
import { logger } from "./lib/logger";

createApp().listen(config.PORT, () => {
  // No se registran valores de configuración: el objeto config contiene secretos.
  logger.info("AchoFlores API iniciada");
});
