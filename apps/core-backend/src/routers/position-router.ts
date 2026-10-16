import { Router } from "express";
import { asyncHandler } from "../utils/asyn-wrapper.js";
import * as positionController from "../controller/position-controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const positionRouter: Router = Router();

positionRouter.get("/all",
    requireAuth,
    asyncHandler(positionController.getAllOpenPositions)
);

positionRouter.get("/:symbol",
    requireAuth,
    asyncHandler(positionController.getOpenPosition)
);

export default positionRouter;
