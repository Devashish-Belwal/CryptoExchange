import { REDIS_STREAMS, type AnyMarketEvent, type AnyTradeResult } from "@workspace/shared";
import RedisManager from "./client";

export class RedisPublisher {
    static async publishBackendRequestEvent(event: AnyMarketEvent) {
        const redis = await RedisManager.getInstance();
        return redis.xAdd(REDIS_STREAMS.ENGINE_REQUEST, "*", { data: JSON.stringify(event) });
    }

    static async publishEngineResponseEvent(event: AnyTradeResult) {
        const redis = await RedisManager.getInstance();
        return redis.xAdd(REDIS_STREAMS.ENGINE_RESPONSE, "*", { data: JSON.stringify(event) });
    }
}