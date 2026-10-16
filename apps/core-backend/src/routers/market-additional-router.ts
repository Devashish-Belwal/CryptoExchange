import { Router } from "express";
import { asyncHandler } from "../utils/asyn-wrapper.js";
import * as marketAddRoutes from "../controller/market-additional-controller.js";

const marketAdditionalRouter: Router = Router();

marketAdditionalRouter.get("/marketRisk/:symbol",
    asyncHandler(marketAddRoutes.getMarketRisk)
);

marketAdditionalRouter.get("/openInterest/:symbol",
    asyncHandler(marketAddRoutes.getOpenInterestBySymbol)
);

export default marketAdditionalRouter;