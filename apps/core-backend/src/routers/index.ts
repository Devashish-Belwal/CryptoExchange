import { Router } from "express";
import authRouter from "./auth-router.js";
import marketRouter from "./market-router.js";
import assetRouter from "./asset-router.js";
import tickerRouter from "./ticker-router.js";
import depthRouter from "./depth-router.js";
import tradeRouter from "./trade-router.js";
import marketAdditionalRouter from "./market-additional-router.js";
import klinesRouer from "./klines-router";
import orderRouter from "./order.router.js";
import healthRouter from "./health-router.js";
import historyRouter from "./history.router.js";
import positionRouter from "./position-router.js";
import fundRouter from "./fund-router.js";

const appRouter: Router = Router();

appRouter.use("/", healthRouter);

appRouter.use("/auth", authRouter);

appRouter.use("/asset", assetRouter);

appRouter.use("/market", marketRouter);

appRouter.use("/order", orderRouter);

appRouter.use("/depth", depthRouter);

appRouter.use("/tickers", tickerRouter);

appRouter.use("/klines", klinesRouer);

appRouter.use("/trades", tradeRouter);

appRouter.use("/", marketAdditionalRouter);

appRouter.use("/history", historyRouter);

appRouter.use("/position", positionRouter);

appRouter.use("/funds", fundRouter);

export default appRouter;