import { Router } from "express";
import { asyncHandler, idempotencyHandler } from "../utils/asyn-wrapper.js";
import * as assetController from "../controller/asset-controller.js";
import { requireAdminAuth } from "../middlewares/auth.middleware.js";

const assetRouter: Router = Router();

assetRouter.get("/",
    asyncHandler(assetController.getAllAssets)
);

assetRouter.get("/:symbol",
    asyncHandler(assetController.getAssetBySymbol)
);

assetRouter.post("/",
    ...idempotencyHandler(
        assetController.createAsset,
        [requireAdminAuth]
    )
);

assetRouter.put("/:symbol",
    ...idempotencyHandler(
        assetController.updateAsset,
        [requireAdminAuth]
    )
);

assetRouter.delete("/:symbol",
    ...idempotencyHandler(
        assetController.deleteAsset,
        [requireAdminAuth]
    )
);

export default assetRouter;