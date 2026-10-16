import { Router } from "express";
import { asyncHandler } from "../utils/asyn-wrapper.js";
import * as tickerController from "../controller/ticker-controller.js";

const tickerRouter: Router = Router();

tickerRouter.get("/",
    asyncHandler(tickerController.getAllMarketsTickers)
);

tickerRouter.get("/:symbol",
    asyncHandler(tickerController.getMarketTickerBySymbol)
);

export default tickerRouter;