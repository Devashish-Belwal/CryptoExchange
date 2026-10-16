import RedisManager from "./client";
import { ConsumeOptions } from "@workspace/shared";

export class RedisConsumer {
    constructor(private options: ConsumeOptions) { }

    async start() {
        const blockingRedisClient = await RedisManager.createBlockingConnection(`${this.options.stream}:${this.options.group}:${this.options.consumer}`)
        const redisClient = await RedisManager.getInstance();

        while (true) {
            try {
                const response = await blockingRedisClient.xReadGroup(
                    this.options.group, this.options.consumer,
                    [{ key: this.options.stream, id: ">" }],
                    {
                        BLOCK: this.options.blockTime || 100,
                        COUNT: this.options.batchSize || 1
                    }
                )

                if (!response) continue;

                for (const streamData of response) {
                    for (const message of streamData.messages) {
                        try {
                            const raw = message.message.data;

                            if (typeof raw !== "string") {
                                console.error(`Invalid message data: ${raw}`);
                                continue;
                            }

                            const parsedData: unknown = JSON.parse(raw);

                            await this.options.handler(parsedData);
                            await redisClient.xAck(this.options.stream, this.options.group, message.id);

                        } catch (error) {
                            console.error(`Failed in processing consumers data: ${error}`);
                        }
                    }
                }

            } catch (error) {
                console.log(`Redis Conumser Crasher: ${error}`);
            }
        }
    }
}
