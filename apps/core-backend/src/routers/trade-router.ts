import { Router } from "express";
import { asyncHandler } from "../utils/asyn-wrapper.js";
import * as tradeController from "../controller/trade-controller.js"

const tradeRouter: Router = Router();

tradeRouter.get("/:symbol",
    asyncHandler(tradeController.getCurrentMarketTrades)
);

tradeRouter.get("/history/:symbol",
    asyncHandler(tradeController.getHistoricalMarketTrades)
);

export default tradeRouter;