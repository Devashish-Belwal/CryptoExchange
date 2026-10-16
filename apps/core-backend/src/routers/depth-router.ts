import { Router } from "express";
import { asyncHandler } from "../utils/asyn-wrapper.js";
import * as depthController from "../controller/depth-controller.js";

const depthRouter: Router = Router();

depthRouter.get("/:symbol",
    asyncHandler(depthController.getMarketDepthBySymbol)
);

export default depthRouter;