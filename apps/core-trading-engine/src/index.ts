import { Engine } from "./engine/core-engine";
import { connectRedis } from "./utils/redis-router";
import { triggerSnapshot } from "./utils/snapshot-trigger";
import http from "node:http";
import dotenv from "dotenv";
dotenv.config();

const PORT = process.env.PORT ? Number(process.env.PORT) : 8081;

type HealthState = {
    startedAt: number;
    redisConnected: boolean,
    snaphotBucketConnected: boolean,
}

export const health: HealthState = {
    startedAt: Date.now(),
    redisConnected: false,
    snaphotBucketConnected: false,
}

function isHealthy() {
    return (health.snaphotBucketConnected && health.redisConnected)
}

const server = http.createServer((req, res) => {
    if (req.url === "/alive") {
        res.writeHead(200, {
            "Content-Type": "application/json",
        });

        res.end(JSON.stringify({
            success: true,
            status: "alive",
            message: "Trading Engine is up and running",
            uptime: process.uptime(),
            startedAt: health.startedAt,
            timestamp: new Date().toISOString(),
        }))
        return;
    }

    if (req.url === "/ready") {
        const healthy = isHealthy();

        res.writeHead(healthy ? 200 : 503, {
            "Content-Type": "application/json",
        });

        res.end(JSON.stringify({
            success: true,
            status: healthy ? "ready" : "not-ready",
            redisConnected: health.redisConnected,
            snaphotBucketConnected: health.snaphotBucketConnected,
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
        }))
        return;
    }

    res.writeHead(403);
    res.end();
})


async function main() {
    const engine = await Engine.create();
    console.log("Engine Started");

    await engine.snapshotEngine.ping();

    await triggerSnapshot(engine);

    const redisConsumer = await connectRedis(engine);

    health.redisConnected = true;

    server.listen(PORT, () => {
        console.log(`Trade Engine Server listening on port ${PORT}`);
    })

    await redisConsumer.start();

    let shuttingDown = false;

    const shutdown = async (signal: string) => {
        if (shuttingDown) return;
        shuttingDown = true;

        console.log(`${signal} received, shutting down trading engine gracefully`);

        server.close();

        try {
            await engine.snapshotEngine.uploadSnapshot(engine.eventSequenceId);
            console.log("Final snapshot uploaded before shutdown");
        } catch (error) {
            console.error("Failed to upload final snapshot on shutdown:", error);
        }

        process.exit(0);
    };

    process.on("SIGTERM", () => void shutdown("SIGTERM"));
    process.on("SIGINT", () => void shutdown("SIGINT"));
}

void main().catch((error) => {
    console.error(error)
    process.exit(1)
});
