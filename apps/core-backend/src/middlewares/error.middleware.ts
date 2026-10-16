import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/errors";
import { RedisManager } from "@workspace/redis-streams";

export const errorHandler = async (
    err: Error,
    req: Request,
    res: Response,
    _next: NextFunction
): Promise<void> => {
    const isApiError = err instanceof ApiError;
    const isCorsError = err.message?.startsWith("CORS blocked");

    const statusCode = isApiError ? err.statusCode : isCorsError ? 403 : 500;
    const type = isApiError ? err.type : isCorsError ? "CorsError" : "InternalServerError";
    const message = isApiError
        ? err.message
        : process.env.NODE_ENV === "production"
            ? "Internal Server Error"
            : err.message;

    console.error({
        type,
        message: err.message,
        method: req.method,
        path: req.originalUrl,
        stack: err.stack,
    });

    try {
        const redisKey = res.locals.idempotencyKey;

        if (redisKey != null) {
            const redisClient = await RedisManager.getInstance();
            await redisClient.del(redisKey);
        }

    } catch (error) {
        console.error(error);
    }

    res.status(statusCode).json({
        success: false,
        error: {
            type,
            message,
            statusCode,
        },
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
    });
};