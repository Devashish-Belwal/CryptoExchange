import { Router } from "express";
import { asyncHandler, idempotencyHandler } from "../utils/asyn-wrapper.js";
import * as orderController from "../controller/order-controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const orderRouter: Router = Router();

orderRouter.post("/",
    requireAuth,
    ...idempotencyHandler(orderController.createOrder)
);

orderRouter.get("/:symbol",
    requireAuth,
    asyncHandler(orderController.getOrder)
);

orderRouter.get("/:symbol/all",
    requireAuth,
    asyncHandler(orderController.getAllOpenOrders)
);

orderRouter.delete("/:symbol",
    requireAuth,
    idempotencyHandler(orderController.cancelOrder)
);

orderRouter.delete("/:symbol/all",
    requireAuth,
    idempotencyHandler(orderController.deleteAllOpenOrders)
);

export default orderRouter;