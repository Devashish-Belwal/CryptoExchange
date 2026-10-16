import type { Request, Response } from "express";
import { EVENT_SOURCE, EVENT_SUBJECT, GetOneMarketOpenInterestResponsePayload, GetOneMarketRiskResponsePayload } from "@workspace/shared";
import { EngineError, ValidationError } from "../utils/errors.js";
import { RedisRouter } from "../utils/redis-router.js";

export const getMarketRisk = async (req: Request, res: Response) => {
    const { symbol } = req.params;

    if (!symbol || Array.isArray(symbol)) {
        throw new ValidationError("Invalid symbol parameter");
    }

    const result = await RedisRouter.sendRequestToEngine({
        source: EVENT_SOURCE.BACKEND,
        type: EVENT_SUBJECT.GET_ONE_MARKET_RISK,
        payload: { symbol }
    });

    if (!result.success) throw new EngineError(result.message);

    if (result.type !== EVENT_SUBJECT.GET_ONE_MARKET_RISK || !result.payload) throw new EngineError(result.message);

    const payload = result.payload as GetOneMarketRiskResponsePayload;

    return res.status(200).json({
        success: true,
        message: "Market risk fetched successful",
        data: { ...payload },
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
}

export const getOpenInterestBySymbol = async (req: Request, res: Response) => {
    const { symbol } = req.params;

    if (!symbol || Array.isArray(symbol)) {
        throw new ValidationError("Invalid symbol parameter");
    }

    const result = await RedisRouter.sendRequestToEngine({
        source: EVENT_SOURCE.BACKEND,
        type: EVENT_SUBJECT.GET_ONE_OPEN_INTEREST,
        payload: { symbol }
    });

    if (!result.success) throw new EngineError(result.message);

    if (result.type !== EVENT_SUBJECT.GET_ONE_OPEN_INTEREST || !result.payload) throw new EngineError(result.message);

    const payload = result.payload as GetOneMarketOpenInterestResponsePayload;

    return res.status(200).json({
        success: true,
        message: "Open interest fetched successful",
        data: { ...payload },
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
}
