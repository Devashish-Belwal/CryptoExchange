import type { Request, Response } from "express";
import { EVENT_SOURCE, EVENT_SUBJECT, GetAllUserOpenPositionResponsePayload, GetUserOpenPositionResponsePayload } from "@workspace/shared";
import { AuthenticationError, EngineError, ValidationError } from "../utils/errors.js";
import { RedisRouter } from "../utils/redis-router.js";

export const getAllOpenPositions = async (req: Request, res: Response) => {
    const userId = req.userId;

    if (!userId) throw new AuthenticationError("User authentication required");

    const result = await RedisRouter.sendRequestToEngine({
        source: EVENT_SOURCE.BACKEND,
        type: EVENT_SUBJECT.GET_ALL_USER_OPEN_POSITION,
        payload: { userId }
    });

    if (!result.success) throw new EngineError(result.message);

    if (result.type !== EVENT_SUBJECT.GET_ALL_USER_OPEN_POSITION || !result.payload) {
        throw new EngineError("Position response payload is missing");
    }

    const payload = result.payload as GetAllUserOpenPositionResponsePayload;

    return res.status(200).json({
        success: true,
        message: "Open positions fetched successful",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        data: { ...payload },
    });
}

export const getOpenPosition = async (req: Request, res: Response) => {
    const userId = req.userId;

    if (!userId) throw new AuthenticationError("User authentication required");

    const { symbol } = req.params;

    if (!symbol || Array.isArray(symbol)) {
        throw new ValidationError("Invalid symbol parameter");
    }

    const result = await RedisRouter.sendRequestToEngine({
        source: EVENT_SOURCE.BACKEND,
        type: EVENT_SUBJECT.GET_USER_OPEN_POSITION,
        payload: { userId, symbol }
    });

    if (!result.success) throw new EngineError(result.message);

    if (result.type !== EVENT_SUBJECT.GET_USER_OPEN_POSITION || !result.payload) {
        throw new EngineError("Position response payload is missing");
    }

    const payload = result.payload as GetUserOpenPositionResponsePayload;

    return res.status(200).json({
        success: true,
        message: "Open position fetched successful",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        data: { ...payload },
    });
}
