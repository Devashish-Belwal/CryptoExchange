import type { Request, Response } from "express";
import { EVENT_SOURCE, EVENT_SUBJECT, GetMarketDepthResponsePayload } from "@workspace/shared";
import { EngineError, ValidationError } from "../utils/errors.js";
import { RedisRouter } from "../utils/redis-router.js";

const MAX_LIMIT = 100;

export const getMarketDepthBySymbol = async (req: Request, res: Response) => {
    const { symbol } = req.params;

    if (!symbol || Array.isArray(symbol)) {
        throw new ValidationError("Invalid symbol parameter");
    }

    const { limit } = req.query;

    let parsedLimit: number | undefined;

    if (limit !== undefined) {
        if (typeof limit !== "string" || !/^[1-9]\d*$/.test(limit)) {
            throw new ValidationError("Invalid limit parameter");
        }

        parsedLimit = Math.min(Number(limit), MAX_LIMIT);
    }

    const result = await RedisRouter.sendRequestToEngine({
        source: EVENT_SOURCE.BACKEND,
        type: EVENT_SUBJECT.GET_MARKET_DEPTH,
        payload: { symbol, limit: parsedLimit }
    });

    if (!result.success) throw new EngineError(result.message);

    if (result.type !== EVENT_SUBJECT.GET_MARKET_DEPTH || !result.payload) throw new EngineError(result.message);

    const payload = result.payload as GetMarketDepthResponsePayload;

    return res.status(200).json({
        success: true,
        message: "Market depth fetched successful",
        data: { ...payload },
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
}
