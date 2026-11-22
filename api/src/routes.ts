import { Router } from "express";
import { authRouter } from "./modules/auth/auth.routes";
import { stallsRouter } from "./modules/stalls/stalls.routes";
import { adminRouter } from "./modules/admin/admin.routes";
import { imagesRouter, productsRouter } from "./modules/products/products.routes";
import { catalogRouter } from "./modules/catalog/catalog.routes";
import { cartRouter } from "./modules/cart/cart.routes";
import { checkoutRouter } from "./modules/orders/checkout.routes";
import { merchantOrdersRouter } from "./modules/orders/merchant-orders.routes";
import { sandboxGatewayRouter } from "./modules/payments/payments.routes";
import { customerOrdersRouter } from "./modules/orders/customer-orders.routes";
import { notificationsRouter } from "./modules/notifications/notifications.routes";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/stalls", stallsRouter);
apiRouter.use("/admin", adminRouter);
apiRouter.use("/products", productsRouter);
apiRouter.use("/images", imagesRouter);
apiRouter.use("/catalog", catalogRouter);
apiRouter.use("/cart", cartRouter);
apiRouter.use("/checkout", checkoutRouter);
apiRouter.use("/merchant/orders", merchantOrdersRouter);
apiRouter.use("/sandbox-gateway", sandboxGatewayRouter);
apiRouter.use("/orders", customerOrdersRouter);
apiRouter.use("/notifications", notificationsRouter);
apiRouter.use("/merchant/dashboard", dashboardRouter);
