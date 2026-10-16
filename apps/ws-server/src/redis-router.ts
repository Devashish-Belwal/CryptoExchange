import { RedisManager } from "@workspace/redis-streams";
import { AnyTradeResult, REDIS_STREAMS } from "@workspace/shared";
import { v4 as uuidv4 } from "uuid";
import type { WsGateway } from "./ws-gateway";
import { health } from ".";

const BATCH_SIZE = process.env.WS_SERVER_BATCH_SIZE ? Number(process.env.WS_SERVER_BATCH_SIZE) : 100;
const BLOCK_TIME_MS = process.env.WS_SERVER_BLOCK_TIME_MS ? Number(process.env.WS_SERVER_BLOCK_TIME_MS) : 1_000;

export class RedisResponseRouter {
    public readonly engineId: string;

    private isRunning = false;

    constructor() {
        this.engineId = `ws-engine-${uuidv4()}`;
    }

    async startRedisListener(gateway: WsGateway) {
        if (this.isRunning) return;

        this.isRunning = true;
        health.redisConnected = true;

        if (!Number.isInteger(BATCH_SIZE) || BATCH_SIZE <= 0) {
            throw new Error("WS_SERVER_BATCH_SIZE must be a positive integer");
        }

        if (!Number.isInteger(BLOCK_TIME_MS) || BLOCK_TIME_MS <= 0) {
            throw new Error("WS_SERVER_BLOCK_TIME_MS must be a positive integer");
        }

        const blockingRedisClient = await RedisManager.createBlockingConnection(`response:${this.engineId}`)

        const redisStream = REDIS_STREAMS.ENGINE_RESPONSE;

        console.log(`Starting listening to redis responses on stream: ${redisStream}`);

        (async () => {
            let lastId = "0";
            lastId = "$";

            while (this.isRunning) {
                try {
                    const response = await blockingRedisClient.xRead(
                        [{ key: REDIS_STREAMS.ENGINE_RESPONSE, id: lastId }],
                        { BLOCK: BLOCK_TIME_MS, COUNT: BATCH_SIZE }
                    );

                    if (!response) continue;

                    for (const streamData of response) {
                        const parsedData: AnyTradeResult[] = [];

                        for (const message of streamData.messages) {
                            lastId = message.id;

                            try {
                                const raw = message.message.data;

                                if (typeof raw !== "string") {
                                    console.error(`Invalid message data: ${raw}`);
                                    continue;
                                }

                                const parsed: AnyTradeResult = JSON.parse(raw);

                                parsedData.push(parsed);

                            } catch (error) {
                                console.error("Invalid WebSocket stream event", error);
                            }
                        }

                        for (const event of parsedData) {
                            dispatchUpdates(gateway, event);
                        }
                    }
                } catch (error) {
                    console.error("Error in reading redis response loop", error);
                    health.redisConnected = false;
                }
            }
        }
        )();
    }

    stop() {
        this.isRunning = false;
        health.redisConnected = false;
    }
}

function dispatchUpdates(gateway: WsGateway, event: AnyTradeResult) {
    const updates = event.updates;
    if (!updates) return;

    for (const depth of updates.depths ?? []) gateway.publish("depth", depth.symbol, depth);
    for (const ticker of updates.tickers ?? []) gateway.publish("ticker", ticker.symbol, ticker);
    for (const markPrice of updates.markPrices ?? []) gateway.publish("markprice", markPrice.symbol, markPrice);
    for (const trade of updates.trades ?? []) gateway.publish("trade", trade.symbol, trade);
}

export const RedisRouter = new RedisResponseRouter();
