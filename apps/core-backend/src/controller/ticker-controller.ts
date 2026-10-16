import type { Request, Response } from "express";
import { EVENT_SOURCE, EVENT_SUBJECT, GetAllTickersResponsePayload, GetOneTickerResponsePayload } from "@workspace/shared";
import { EngineError, ValidationError } from "../utils/errors.js";
import { RedisRouter } from "../utils/redis-router.js";

export const getAllMarketsTickers = async (req: Request, res: Response) => {
    const result = await RedisRouter.sendRequestToEngine({
        source: EVENT_SOURCE.BACKEND,
        type: EVENT_SUBJECT.GET_ALL_TICKER,
        payload: {},
    });

    if (!result.success) throw new EngineError(result.message);

    if (result.type !== EVENT_SUBJECT.GET_ALL_TICKER || !result.payload) throw new EngineError(result.message);

    const payload = result.payload as GetAllTickersResponsePayload;

    return res.status(200).json({
        success: true,
        message: "Tickers fetched successful",
        data: payload.tickers,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
}

export const getMarketTickerBySymbol = async (req: Request, res: Response) => {
    const { symbol } = req.params;

    if (!symbol || Array.isArray(symbol)) {
        throw new ValidationError("Invalid symbol parameter");
    }

    const result = await RedisRouter.sendRequestToEngine({
        source: EVENT_SOURCE.BACKEND,
        type: EVENT_SUBJECT.GET_ONE_TICKER,
        payload: { symbol },
    });

    if (!result.success) throw new EngineError(result.message);

    if (result.type !== EVENT_SUBJECT.GET_ONE_TICKER || !result.payload) throw new EngineError(result.message);

    const payload = result.payload as GetOneTickerResponsePayload;

    return res.status(200).json({
        success: true,
        message: "Ticker fetched successful",
        data: payload.ticker,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
}
