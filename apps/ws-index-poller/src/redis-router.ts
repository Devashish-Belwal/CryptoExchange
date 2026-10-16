import { v4 as uuidv4 } from "uuid";
import { RedisPublisher } from "@workspace/redis-streams";
import { EngineRequestUnion, EVENT_SOURCE, EVENT_SUBJECT, FundingUpdateEventPayload, latestPricesMapType } from "@workspace/shared";
import { FUNDING_INTERVAL_SECONDS, health } from ".";

const latestPrice: latestPricesMapType = new Map();

export async function publishFundingSettlements() {
    for (const [symbol] of latestPrice) {
        const payload: FundingUpdateEventPayload = {
            symbol,
            intervalSeconds: FUNDING_INTERVAL_SECONDS,
        };

        await publish({ type: EVENT_SUBJECT.FUNDING_RATE_UPDATE_EVENT, payload });
    }
}

export async function publish(event: EngineRequestUnion) {
    try {
        await RedisPublisher.publishBackendRequestEvent({
            ...event,
            requestId: uuidv4(),
            backendId: "ws-index-poller",
            source: EVENT_SOURCE.WS,
            timestamp: Date.now()
        });
        health.redisHealthy = true;

    } catch (error) {
        health.redisHealthy = false;
        console.log(error);
    }
}