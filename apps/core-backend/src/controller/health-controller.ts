import type { Request, Response } from "express";
import { RedisRouter } from "../utils/redis-router";
import { EVENT_SOURCE, EVENT_SUBJECT } from "@workspace/shared";

type HealthState = {
    startedAt: number;
    redisConnected: boolean,
    tradeEngineConnected: boolean,
}

export const health: HealthState = {
    startedAt: Date.now(),
    redisConnected: false,
    tradeEngineConnected: false,
}

function isHealthy() {
    return (health.tradeEngineConnected && health.redisConnected)
}

export const getCoreBackendAlive = async (req: Request, res: Response) => {
    return res.status(200).json({
        success: true,
        status: "alive",
        message: "Core Backend is up and running",
        uptime: process.uptime(),
        startedAt: health.startedAt,
        timestamp: new Date().toISOString(),
    });
}

export const getTradingEngineReady = async (req: Request, res: Response) => {
    try {
        const result = await RedisRouter.sendRequestToEngine({
            source: EVENT_SOURCE.BACKEND,
            type: EVENT_SUBJECT.HEALTH_CHECK,
            payload: {
                message: "Is everything ok"
            }
        });

        health.tradeEngineConnected = result.success;
    } catch {
        health.tradeEngineConnected = false;
    }

    const healthy = isHealthy();

    return res.status(healthy ? 200 : 503).json({
        success: true,
        status: healthy ? "ready" : "not-ready",
        tradeEngineConnected: health.tradeEngineConnected,
        redisConnected: health.redisConnected,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
}
