import type { Request, Response } from "express";
import { ApiError, AuthenticationError, ValidationError } from "../utils/errors";
import { CancelOrderResponsePayload, CreateOrderClientSchema, DeleteAllOpenOrderResponsePayload, EVENT_SOURCE, EVENT_SUBJECT, GetAllOpenOrderResponsePayload, GetOneOpenOrderResponsePayload } from "@workspace/shared"
import { RedisRouter } from "../utils/redis-router";

function requireSymbolParam(req: Request): string {
    const { symbol } = req.params;

    if (!symbol || Array.isArray(symbol)) {
        throw new ValidationError("Invalid symbol parameter");
    }

    return symbol;
}

function requireOrderIdQuery(req: Request): string {
    const { orderId } = req.query;

    if (!orderId || typeof orderId !== "string") {
        throw new ValidationError("orderId query parameter is required");
    }

    return orderId;
}

export const getOrder = async (req: Request, res: Response) => {
    const userId = req.userId;

    if (!userId) throw new AuthenticationError("User authentication required");

    const symbol = requireSymbolParam(req);
    const orderId = requireOrderIdQuery(req);

    const result = await RedisRouter.sendRequestToEngine({
        source: EVENT_SOURCE.BACKEND,
        type: EVENT_SUBJECT.GET_ONE_OPEN_ORDER,
        payload: { orderId, userId, symbol }
    });

    if (!result.success) throw new ApiError(400, "TRADING_ENGINE_ERROR", result.message);

    if (result.type !== EVENT_SUBJECT.GET_ONE_OPEN_ORDER || !result.payload) {
        throw new ApiError(500, "TRADING_ENGINE_ERROR", "Order response payload is missing");
    }

    const payload = result.payload as GetOneOpenOrderResponsePayload;

    return res.status(200).json({
        success: true,
        message: result.message,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        data: { ...payload },
    });
}

export const getAllOpenOrders = async (req: Request, res: Response) => {
    const userId = req.userId;

    if (!userId) throw new AuthenticationError("User authentication required");

    const symbol = requireSymbolParam(req);

    const result = await RedisRouter.sendRequestToEngine({
        source: EVENT_SOURCE.BACKEND,
        type: EVENT_SUBJECT.GET_ALL_OPEN_ORDER,
        payload: { userId, symbol }
    });

    if (!result.success) throw new ApiError(400, "TRADING_ENGINE_ERROR", result.message);

    if (result.type !== EVENT_SUBJECT.GET_ALL_OPEN_ORDER || !result.payload) {
        throw new ApiError(500, "TRADING_ENGINE_ERROR", "Order response payload is missing");
    }

    const payload = result.payload as GetAllOpenOrderResponsePayload;

    return res.status(200).json({
        success: true,
        message: result.message,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        data: { ...payload },
    });
}

export const createOrder = async (req: Request, res: Response) => {
    const body = req.body;

    const userId = req.userId;

    if (!userId) throw new AuthenticationError("User authentication required");

    const validateData = CreateOrderClientSchema.safeParse(body);

    if (!validateData.success) throw new ValidationError(validateData.error.issues.map(issue => issue.message).join(", "));

    const { symbol, entryPrice, quantity, side, leverage, type, postOnly, marketType, reduceOnly, stpMode, timeInForce } = validateData.data;

    const result = await RedisRouter.sendRequestToEngine({
        source: EVENT_SOURCE.BACKEND,
        type: EVENT_SUBJECT.ORDER_CREATE,
        payload: {
            entryPrice, quantity, userId, symbol,
            side, type, postOnly, stpMode,
            timeInForce, createdAt: Date.now(),
            reduceOnly, leverage, marketType
        }
    });

    if (!result.success) throw new ApiError(400, "TRADING_ENGINE_ERROR", result.message);

    if (result.type !== EVENT_SUBJECT.ORDER_CREATE || !result.payload) {
        throw new ApiError(500, "TRADING_ENGINE_ERROR", "Order response payload is missing");
    }

    return res.status(200).json({
        success: result.success,
        message: result.message,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        data: { order: result.payload },
    });
}

export const cancelOrder = async (req: Request, res: Response) => {
    const userId = req.userId;

    if (!userId) throw new AuthenticationError("User authentication required");

    const symbol = requireSymbolParam(req);
    const orderId = requireOrderIdQuery(req);

    const result = await RedisRouter.sendRequestToEngine({
        source: EVENT_SOURCE.BACKEND,
        type: EVENT_SUBJECT.ORDER_CANCEL,
        payload: { orderId, userId, symbol }
    });

    if (!result.success) throw new ApiError(400, "TRADING_ENGINE_ERROR", result.message);

    if (result.type !== EVENT_SUBJECT.ORDER_CANCEL || !result.payload) {
        throw new ApiError(500, "TRADING_ENGINE_ERROR", "Order response payload is missing");
    }

    const payload = result.payload as CancelOrderResponsePayload;

    return res.status(200).json({
        success: true,
        message: result.message,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        data: { ...payload },
    });
}

export const deleteAllOpenOrders = async (req: Request, res: Response) => {
    const userId = req.userId;

    if (!userId) throw new AuthenticationError("User authentication required");

    const symbol = requireSymbolParam(req);

    const result = await RedisRouter.sendRequestToEngine({
        source: EVENT_SOURCE.BACKEND,
        type: EVENT_SUBJECT.DELETE_ALL_OPEN_ORDER,
        payload: { userId, symbol }
    });

    if (!result.success) throw new ApiError(400, "TRADING_ENGINE_ERROR", result.message);

    if (result.type !== EVENT_SUBJECT.DELETE_ALL_OPEN_ORDER || !result.payload) {
        throw new ApiError(500, "TRADING_ENGINE_ERROR", "Order response payload is missing");
    }

    const payload = result.payload as DeleteAllOpenOrderResponsePayload;

    return res.status(200).json({
        success: true,
        message: result.message,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        data: { ...payload },
    });
}
