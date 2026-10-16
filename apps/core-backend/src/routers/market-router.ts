import { Router } from "express";
import { asyncHandler, idempotencyHandler } from "../utils/asyn-wrapper.js";
import * as marketController from "../controller/market-controller.js";
import { requireAdminAuth } from "../middlewares/auth.middleware.js";

const marketRouter: Router = Router();

marketRouter.post("/",
    ...idempotencyHandler(marketController.createMarket, [requireAdminAuth])
);

marketRouter.put("/:symbol",
    ...idempotencyHandler(marketController.updateMarket, [requireAdminAuth])
);

marketRouter.delete("/:symbol",
    ...idempotencyHandler(marketController.deleteMarket, [requireAdminAuth])
);

marketRouter.get("/",
    asyncHandler(marketController.getAllMarkets)
);

marketRouter.get("/metadata",
    asyncHandler(marketController.getMarketMetaData)
);

marketRouter.get("/:symbol",
    asyncHandler(marketController.getMarketBySymbol)
);

export default marketRouter;