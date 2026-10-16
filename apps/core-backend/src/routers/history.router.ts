import { Router } from "express";
import { asyncHandler } from "../utils/asyn-wrapper.js";
import * as historyController from "../controller/history-controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const historyRouter: Router = Router();

historyRouter.get("/trades",
    requireAuth,
    asyncHandler(historyController.getUserTradesHistory)
);

historyRouter.get("/orders",
    requireAuth,
    asyncHandler(historyController.getUserOrdersHistory)
);

historyRouter.get("/positions",
    requireAuth,
    asyncHandler(historyController.getUserPositionsHistory)
);

historyRouter.get("/balances",
    requireAuth,
    asyncHandler(historyController.getUserBalanceLedger)
);

export default historyRouter;