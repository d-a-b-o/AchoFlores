import { Router } from "express";
import { authRouter } from "./modules/auth/auth.routes";
import { stallsRouter } from "./modules/stalls/stalls.routes";
import { adminRouter } from "./modules/admin/admin.routes";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/stalls", stallsRouter);
apiRouter.use("/admin", adminRouter);
