import { initializeRedisStreams, RedisConsumer, RedisPublisher } from "@workspace/redis-streams";
import { AnyMarketEvent, AnyTradeResult, CONSUMER_GROUPS, EVENT_SOURCE, EVENT_SUBJECT, REDIS_STREAMS } from "@workspace/shared";
import { Engine } from "../engine/core-engine";

const stream = REDIS_STREAMS.ENGINE_REQUEST;
const group = CONSUMER_GROUPS.TRADE_ENGINE;
const consumer = `${group}-${process.pid}`;

function isValidMarketEvent(data: unknown): data is AnyMarketEvent {
    if (!data || typeof data !== "object") {
        return false;
    }

    const event = data as Record<string, unknown>;

    return Object.values(EVENT_SUBJECT).includes(event.type as EVENT_SUBJECT)
        && Object.values(EVENT_SOURCE).includes(event.source as EVENT_SOURCE)
        && typeof event.payload === "object" && event.payload !== null;
}

export async function connectRedis(engine: Engine) {

    await initializeRedisStreams();

    const redisConsumer = new RedisConsumer({
        stream, group, consumer,
        handler: async (data: unknown) => {

            if (!isValidMarketEvent(data)) {
                console.error("Rejected malformed engine.request message:", data);
                return;
            }

            const event = data;

            const resultEvent = await engine.process(event);

            if (event.source !== EVENT_SOURCE.BACKEND && resultEvent.updates === undefined) {
                return;
            }

            const result: AnyTradeResult = {
                ...resultEvent,
                requestId: event.requestId,
                backendId: event.backendId,
            };

            await RedisPublisher.publishEngineResponseEvent(result);
        }
    });

    return redisConsumer;
}