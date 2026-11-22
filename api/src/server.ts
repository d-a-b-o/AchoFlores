import { createApp } from "./app";
import { config } from "./config";
import { logger } from "./lib/logger";

createApp().listen(config.PORT, () => {
  logger.info(`AchoFlores API escuchando en el puerto ${config.PORT}`);
});
