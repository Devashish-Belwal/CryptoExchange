import { prisma } from "@workspace/database";
import type { Request, Response } from "express";
import { AuthenticationError, DatabaseError, EngineError, NotFoundError, ValidationError } from "../utils/errors.js";
import { AddAssetResponsePayload, createAssetSchema, DeleteAssetResponsePayload, EVENT_SOURCE, EVENT_SUBJECT, UpdateAssetResponsePayload, updateAssetSchema } from "@workspace/shared";
import { RedisRouter } from "../utils/redis-router.js";


export const getAllAssets = async (req: Request, res: Response) => {
    const assets = await prisma.asset.findMany({ where: { isActive: true } });

    if (assets.length === 0) {
        throw new NotFoundError("No assets created till now");
    }

    return res.status(200).json({
        success: true,
        message: "All Assets fetched successful",
        data: { assets },
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
}

export const getAssetBySymbol = async (req: Request, res: Response) => {
    const { symbol } = req.params;

    if (!symbol || Array.isArray(symbol)) {
        throw new ValidationError("Invalid symbol parameter");
    }

    const asset = await prisma.asset.findUnique({ where: { symbol } });

    if (!asset || !asset.isActive) {
        throw new NotFoundError(`Asset with symbol ${symbol} not found or is inactive`);
    }

    return res.status(200).json({
        success: true,
        message: "Asset fetched successful",
        data: { asset },
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
}

export const createAsset = async (req: Request, res: Response) => {
    const body = req.body;
    const userId = req.userId;

    if (!userId) throw new AuthenticationError("User authentication required");

    const validateData = createAssetSchema.safeParse(body);

    if (!validateData.success) throw new ValidationError(validateData.error.issues.map(issue => issue.message).join(", "));

    const { symbol, isActive } = validateData.data;

    const existingAsset = await prisma.asset.findUnique({ where: { symbol } });

    if (existingAsset) {
        throw new DatabaseError(`Asset with symbol ${symbol} already exists`);
    }

    const result = await RedisRouter.sendRequestToEngine({
        source: EVENT_SOURCE.BACKEND,
        type: EVENT_SUBJECT.ADD_ASSET,
        payload: {
            userId, ...validateData.data,
            isActive: isActive ?? true
        }
    });

    if (!result.success) throw new EngineError(result.message);

    if (result.type !== EVENT_SUBJECT.ADD_ASSET || !result.payload) throw new EngineError(result.message);

    const payload = result.payload as AddAssetResponsePayload;

    return res.status(200).json({
        success: result.success,
        message: "Asset created successful",
        data: { asset: payload },
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
}

export const updateAsset = async (req: Request, res: Response) => {
    const { symbol } = req.params;

    if (!symbol || Array.isArray(symbol)) {
        throw new ValidationError("Invalid id parameter");
    }

    const userId = req.userId;

    if (!userId) throw new AuthenticationError("User authentication required");

    const body = req.body;

    const validateData = updateAssetSchema.safeParse(body);

    if (!validateData.success) throw new ValidationError(validateData.error.issues.map(issue => issue.message).join(", "));

    const { name, logoUrl, precision } = validateData.data;

    const existingAsset = await prisma.asset.findUnique({ where: { symbol } });

    if (!existingAsset) {
        throw new DatabaseError(`Asset with symbol ${symbol} not found`);
    }

    const result = await RedisRouter.sendRequestToEngine({
        source: EVENT_SOURCE.BACKEND,
        type: EVENT_SUBJECT.UPDATE_ASSET,
        payload: { userId, name, symbol, precision, logoUrl }
    });

    if (!result.success) throw new EngineError(result.message);

    if (result.type !== EVENT_SUBJECT.UPDATE_ASSET || !result.payload) throw new EngineError(result.message);

    const payload = result.payload as UpdateAssetResponsePayload;

    return res.status(200).json({
        success: result.success,
        message: "Asset updated successful",
        data: { asset: payload },
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
}

export const deleteAsset = async (req: Request, res: Response) => {
    const { symbol } = req.params;

    if (!symbol || Array.isArray(symbol)) {
        throw new ValidationError("Invalid id parameter");
    }

    const userId = req.userId;

    if (!userId) throw new AuthenticationError("User authentication required");

    const existingAsset = await prisma.asset.findUnique({ where: { symbol } });

    if (!existingAsset) {
        throw new DatabaseError(`Asset with symbol ${symbol} not found`);
    }

    const result = await RedisRouter.sendRequestToEngine({
        source: EVENT_SOURCE.BACKEND,
        type: EVENT_SUBJECT.DELETE_ASSET,
        payload: {
            userId, symbol
        }
    });

    if (!result.success) throw new EngineError(result.message);

    if (result.type !== EVENT_SUBJECT.DELETE_ASSET || !result.payload) throw new EngineError(result.message);

    const payload = result.payload as DeleteAssetResponsePayload;

    return res.status(200).json({
        success: result.success,
        message: "Asset deleted successful",
        data: { asset: payload },
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
}