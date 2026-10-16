import { RedisManager } from "@workspace/redis-streams";
import { CONSUMER_GROUPS, AnyTradeResult, REDIS_STREAMS } from "@workspace/shared";
import { v4 as uuidv4 } from "uuid";
import { DatabaseManager } from "./engine";


const BATCH_SIZE = Number(process.env.DATABASE_ENGINE_BATCH_SIZE ?? 100);
const BLOCK_TIME_MS = Number(process.env.DATABASE_ENGINE_BLOCK_TIME_MS ?? 1_000);

export class RedisResponseRouter {
    public readonly engineId: string;

    private isRunning = false;

    constructor() {
        this.engineId = `db-engine-${uuidv4()}`;
    }

    async startRedisListener() {
        if (this.isRunning) return;

        this.isRunning = true;

        if (!Number.isInteger(BATCH_SIZE) || BATCH_SIZE <= 0) {
            throw new Error("DATABASE_ENGINE_BATCH_SIZE must be a positive integer");
        }

        if (!Number.isInteger(BLOCK_TIME_MS) || BLOCK_TIME_MS <= 0) {
            throw new Error("DATABASE_ENGINE_BLOCK_TIME_MS must be a positive integer");
        }

        const redis = await RedisManager.getInstance();
        const blockingRedisClient = await RedisManager.createBlockingConnection(`response:${this.engineId}`)

        const redisStream = REDIS_STREAMS.ENGINE_RESPONSE;
        const consumer = `${CONSUMER_GROUPS.DATABASE_ENGINE}-${this.engineId}`;

        console.log(`Starting listening to redis responses on stream: ${redisStream}`);

        (async () => {
            while (true) {
                try {
                    const response = await blockingRedisClient.xReadGroup(
                        CONSUMER_GROUPS.DATABASE_ENGINE,
                        consumer,
                        [{ key: REDIS_STREAMS.ENGINE_RESPONSE, id: ">" }],
                        { BLOCK: BLOCK_TIME_MS, COUNT: BATCH_SIZE }
                    );

                    if (!response) continue;

                    for (const streamData of response) {
                        const parsedData: AnyTradeResult[] = [];
                        const ackIds: string[] = [];

                        for (const message of streamData.messages) {
                            try {
                                const raw = message.message.data;

                                if (typeof raw !== "string") {
                                    console.error(`Invalid message data: ${raw}`);
                                    ackIds.push(message.id);
                                    continue;
                                }

                                const parsed: AnyTradeResult = JSON.parse(raw);

                                parsedData.push(parsed);
                                ackIds.push(message.id);

                            } catch (error) {
                                console.error("Invalid database stream event", error);
                                ackIds.push(message.id);
                            }
                        }

                        // console.log(parsedData);
                        for (const event of parsedData) {
                            await DatabaseManager.process(event);
                        }

                        await ack(redis, ackIds);
                    }
                } catch (error) {
                    console.error("Error in reading redis response loop", error);
                }
            }
        }
        )();
    }

    stop() {
        this.isRunning = false;
    }
}

async function ack(
    redis: Awaited<ReturnType<typeof RedisManager.getInstance>>,
    messageIds: string[]
) {
    await Promise.all(messageIds.map((id) =>
        redis.xAck(REDIS_STREAMS.ENGINE_RESPONSE, CONSUMER_GROUPS.DATABASE_ENGINE, id)
    ));
}

export const RedisRouter = new RedisResponseRouter();
