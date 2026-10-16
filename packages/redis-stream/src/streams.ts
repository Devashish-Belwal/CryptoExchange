import RedisManager, { RedisClient } from "./client";
import { REDIS_STREAMS, CONSUMER_GROUPS } from "@workspace/shared"

export async function initializeRedisStreams() {
    const redis = await RedisManager.getInstance();

    await createGroup(redis, REDIS_STREAMS.ENGINE_REQUEST, CONSUMER_GROUPS.TRADE_ENGINE);
    await createGroup(redis, REDIS_STREAMS.ENGINE_RESPONSE, CONSUMER_GROUPS.DATABASE_ENGINE);
    await createGroup(redis, REDIS_STREAMS.ENGINE_RESPONSE, CONSUMER_GROUPS.WS_SERVER);
}

async function createGroup(redis: RedisClient, stream: string, group: string) {

    try {
        await redis.xGroupCreate(stream, group, "0", { MKSTREAM: true, });

        console.log(`Created group ${group}`);

    } catch (err: any) {

        if (err.message.includes("BUSYGROUP")) {
            console.log(`Group ${group} already exists`);
            return;
        }

        throw err;
    }
}

