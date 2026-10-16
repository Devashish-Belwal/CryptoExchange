import { v4 as uuidv4 } from 'uuid';
import { RedisManager, RedisPublisher } from "@workspace/redis-streams"
import { AnyMarketEvent, AnyTradeResult, MarketRequestEventType, REDIS_STREAMS } from '@workspace/shared';

export class RedisResponseRouter {
    public readonly backendId: string;

    private responseMap = new Map<string, {
        resolve: (value: AnyTradeResult) => void;
        reject: (reason?: unknown) => void;
        timeoutId: NodeJS.Timeout;
    }>();

    private isRunning = false;

    constructor() {
        this.backendId = `backend-${uuidv4()}`;
    }

    async startRedisListener() {
        if (this.isRunning) return;
        this.isRunning = true;

        const blockingRedisClient = await RedisManager.createBlockingConnection(`response:${this.backendId}`);
        const redisStream = REDIS_STREAMS.ENGINE_RESPONSE;

        console.log(`Starting listening to redis responses on stream : ${redisStream}`);

        (async () => {
            let lastId = "0";
            lastId = "$";

            while (this.isRunning) {
                try {
                    const response = await blockingRedisClient.xRead(
                        { key: redisStream, id: lastId },
                        { BLOCK: 100, COUNT: 1 }
                    )

                    if (!response) continue;

                    for (const streamData of response) {
                        for (const message of streamData.messages) {
                            lastId = message.id;

                            try {
                                const raw = message.message.data;

                                if (typeof raw !== "string") {
                                    console.error(`Invalid message data: ${raw}`);
                                    continue;
                                }

                                const parsedData: AnyTradeResult = JSON.parse(raw);

                                if (parsedData.backendId !== this.backendId) {
                                    continue;
                                }

                                const pendingRequest = this.responseMap.get(parsedData.requestId);

                                if (pendingRequest) {
                                    clearTimeout(pendingRequest.timeoutId);
                                    this.responseMap.delete(parsedData.requestId);
                                    pendingRequest.resolve(parsedData);
                                }

                            } catch (error) {
                                console.error("Error processing response message", error);
                            }

                        }
                    }

                } catch (error) {
                    console.error("Error in reading redis response loop", error);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        })();
    }

    async sendRequestToEngine(marketEvent: MarketRequestEventType, timeoutMs = 5000): Promise<AnyTradeResult> {
        const requestId: string = uuidv4();
        const payload: AnyMarketEvent = {
            ...marketEvent,
            requestId,
            backendId: this.backendId,
            timestamp: Date.now()
        }

        return new Promise<AnyTradeResult>((resolve, reject) => {

            // Set a request wait timeout for 5s so that the backend stop waiting for the response after some time
            const timeoutId = setTimeout(() => {
                this.responseMap.delete(requestId);
                reject(new Error(`Request timeout after ${timeoutMs}ms`));
            }, timeoutMs);

            // Register the resolve and reject callback in a in memory variable to be called according to the engine result
            this.responseMap.set(requestId, {
                resolve,
                reject,
                timeoutId
            });

            // Publish the message to the engine request stream after the callback is registered
            void RedisPublisher.publishBackendRequestEvent(payload)
                .catch((error) => {
                    clearTimeout(timeoutId);
                    this.responseMap.delete(requestId);
                    reject(error);
                })
        });
    }

    stop() {
        this.isRunning = false;
    }
}

export const RedisRouter = new RedisResponseRouter();
