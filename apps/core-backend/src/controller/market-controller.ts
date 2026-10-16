import { AddMarketResponsePayload, createMarketSchema, EVENT_SOURCE, EVENT_SUBJECT, updateMarketSchema } from "@workspace/shared";
import type { Request, Response } from "express";
import { AuthenticationError, EngineError, NotFoundError, ValidationError } from "../utils/errors.js";
import { prisma } from "@workspace/database";
import { RedisRouter } from "../utils/redis-router.js";

export const createMarket = async (req: Request, res: Response) => {
    const body = req.body;

    const userId = req.userId;

    if (!userId) throw new AuthenticationError("User authentication required");

    const validateData = createMarketSchema.safeParse(body);

    if (!validateData.success) throw new ValidationError(validateData.error.issues.map(issue => issue.message).join(", "));

    const { isActive } = validateData.data;

    const result = await RedisRouter.sendRequestToEngine({
        source: EVENT_SOURCE.BACKEND,
        type: EVENT_SUBJECT.ADD_MARKET,
        payload: {
            userId,
            ...validateData.data,
            isActive: isActive ?? true
        }
    });

    if (!result.success) throw new EngineError(result.message);

    if (result.type !== EVENT_SUBJECT.ADD_MARKET || !result.payload) throw new EngineError(result.message);

    const payload = result.payload as AddMarketResponsePayload;

    return res.status(200).json({
        success: result.success,
        message: "Market created successful",
        data: { ...payload },
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
}

export const updateMarket = async (req: Request, res: Response) => {
    const body = req.body;
    const { symbol } = req.params;

    const userId = req.userId;

    if (!userId) throw new AuthenticationError("User authentication required");

    if (!symbol || Array.isArray(symbol)) {
        throw new ValidationError("Invalid market ID parameter");
    }

    const validateData = updateMarketSchema.safeParse(body);

    if (!validateData.success) throw new ValidationError(validateData.error.issues.map(issue => issue.message).join(", "));

    const isMarketExists = await prisma.market.findUnique({ where: { symbol } });

    if (!isMarketExists) {
        throw new ValidationError(`Market with ID ${symbol} does not exist`);
    }

    const result = await RedisRouter.sendRequestToEngine({
        source: EVENT_SOURCE.BACKEND,
        type: EVENT_SUBJECT.UPDATE_MARKET,
        payload: {
            ...validateData.data,
            userId, symbol,
        }
    });

    if (!result.success) throw new EngineError(result.message);

    if (result.type !== EVENT_SUBJECT.UPDATE_MARKET || !result.payload) throw new EngineError(result.message);

    const payload = result.payload as AddMarketResponsePayload;

    return res.status(200).json({
        success: result.success,
        message: "Market created successful",
        data: { ...payload },
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
}

export const deleteMarket = async (req: Request, res: Response) => {
    const { symbol } = req.params;

    const userId = req.userId;

    if (!userId) throw new AuthenticationError("User authentication required");

    if (!symbol || Array.isArray(symbol)) {
        throw new ValidationError("Invalid market ID parameter");
    }

    const isMarketExists = await prisma.market.findUnique({ where: { symbol } });

    if (!isMarketExists) {
        throw new ValidationError(`Market with ID ${symbol} does not exist`);
    }

    const result = await RedisRouter.sendRequestToEngine({
        source: EVENT_SOURCE.BACKEND,
        type: EVENT_SUBJECT.DELETE_MARKET,
        payload: {
            userId, symbol,
        }
    });

    if (!result.success) throw new EngineError(result.message);

    if (result.type !== EVENT_SUBJECT.DELETE_MARKET || !result.payload) throw new EngineError(result.message);

    const payload = result.payload as AddMarketResponsePayload;

    return res.status(200).json({
        success: result.success,
        message: "Market deleted successful",
        data: { ...payload },
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
}

export const getMarketMetaData = async (req: Request, res: Response) => {
    const markets = await prisma.market.findMany({
        where: { isActive: true },
        select: {
            id: true,
            symbol: true,
            name: true,
            marketType: true,
            baseAssetId: true,
            quoteAssetId: true,
            maxLeverage: true,
            minOrderSize: true,
            tickSize: true,
            lotSize: true,
            baseAsset: {
                select: {
                    id: true,
                    name: true,
                    symbol: true,
                    precision: true,
                },
            },
            quoteAsset: {
                select: {
                    id: true,
                    name: true,
                    symbol: true,
                    precision: true,
                },
            },
        },
    })

    return res.status(200).json({
        success: true,
        message: "Market metadata fetched successful",
        data: { markets },
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
}

export const getAllMarkets = async (req: Request, res: Response) => {

    const markets = await prisma.market.findMany({
        include: {
            baseAsset: true,
            quoteAsset: true,
        }
    });

    if (markets.length === 0) {
        throw new NotFoundError("No markets created till now");
    }

    return res.status(200).json({
        success: true,
        message: "Markets fetched successful",
        data: { markets },
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
}

export const getMarketBySymbol = async (req: Request, res: Response) => {
    const { symbol } = req.params;

    if (!symbol || Array.isArray(symbol)) {
        throw new ValidationError("Invalid market ID parameter");
    }

    const market = await prisma.market.findFirst({
        where: { symbol },
        include: {
            baseAsset: true,
            quoteAsset: true,
        }
    });

    if (!market || !market.isActive) {
        throw new NotFoundError(`Market with symbol ${symbol} not found or is inactive`);
    }

    return res.status(200).json({
        success: true,
        message: "Market fetched successful",
        data: { market },
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
}