import { Router } from "express";
import { asyncHandler } from "../utils/asyn-wrapper.js";
import { getCoreBackendAlive, getTradingEngineReady } from "../controller/health-controller.js";

const healthRouter: Router = Router();

healthRouter.get("/alive", asyncHandler(getCoreBackendAlive));
healthRouter.get("/ready", asyncHandler(getTradingEngineReady));

export default healthRouter;