import { Router } from "express";
import { asyncHandler } from "../utils/asyn-wrapper.js";
import { getMarketKlines } from "../controller/klines-controller.js";

const klinesRouer: Router = Router();

klinesRouer.get("/:symbol", asyncHandler(getMarketKlines));

export default klinesRouer;