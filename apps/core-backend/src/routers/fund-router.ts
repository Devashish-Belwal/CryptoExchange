import { Router } from "express";
import { multiAsyncWrapper } from "../utils/asyn-wrapper.js";
import * as fundController from "../controller/fund-controller.js";
import { requireAdminAuth } from "../middlewares/auth.middleware.js";

const fundRouter: Router = Router();

fundRouter.get("/",
    ...multiAsyncWrapper(requireAdminAuth, fundController.getAllFunds)
);

fundRouter.get("/:symbol",
    ...multiAsyncWrapper(requireAdminAuth, fundController.getFundsBySymbol)
);

export default fundRouter;
