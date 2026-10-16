import { RedisManager } from "@workspace/redis-streams";
import { Request, Response, NextFunction } from "express";
import { AuthenticationError, BadRequestError } from "../utils/errors";
import { IdempotencyRecord } from "@workspace/shared";

const TTL = 60 * 60;

export const checkIdempotency = async (request: Request, response: Response, next: NextFunction) => {
    const redisClient = await RedisManager.getInstance();

    const userId = request.userId;

    if (!userId) throw new AuthenticationError("User authentication required");

    const key = request.header("Idempotency-Key");

    if (!key) {
        throw new BadRequestError("Missing Idempotency-Key header.");
    }

    const redisKey = `idempotency:${userId}:${key}`;

    const processing = {
        status: "PROCESSING",
        createdAt: new Date().toISOString(),
    };

    const result = await redisClient.set(redisKey, JSON.stringify(processing), { EX: TTL, NX: true });

    if (result === "OK") {
        response.locals.idempotencyKey = redisKey;
        return next();
    }

    const value = await redisClient.get(redisKey);

    if (!value) {
        return next();
    }

    const data: IdempotencyRecord = JSON.parse(value);

    if (data.status === "PROCESSING") {
        throw new BadRequestError("Request already processing.");
    }

    return response.status(data.response.statusCode).json(data.response.body);
}

export const storeIdempotencyResponse = async (_request: Request, response: Response, next: NextFunction) => {
    const originalResponseJson = response.json.bind(response);

    response.json = async function (body: unknown) {
        const redisClient = await RedisManager.getInstance();

        const redisKey = response.locals.idempotencyKey

        if (redisClient) {

            const redisValue: IdempotencyRecord = {
                status: "COMPLETED",
                createdAt: new Date().toISOString(),
                response: {
                    statusCode: response.statusCode, body
                }
            };

            await redisClient.set(redisKey, JSON.stringify(redisValue), { EX: TTL })
        }

        return originalResponseJson(body);
    } as unknown as Response["json"];

    next();
}