import { prisma } from "@workspace/database";
import { RedisRouter } from "./redis-router";
import dotenv from "dotenv";
import http from "node:http";
import { initializeRedisStreams } from "@workspace/redis-streams";
dotenv.config();

const PORT = process.env.PORT ? Number(process.env.PORT) : 8082

type HealthState = {
    startedAt: number;
    databaseConnected: boolean,
}

export const health: HealthState = {
    startedAt: Date.now(),
    databaseConnected: false
}

const server = http.createServer(async (req, res) => {
    if (req.url === "/alive") {
        res.writeHead(200, {
            "Content-Type": "application/json",
        });

        res.end(JSON.stringify({
            success: true,
            status: "alive",
            message: "Database Engine is up and running",
            uptime: process.uptime(),
            startedAt: health.startedAt,
            timestamp: new Date().toISOString(),
        }))
        return;
    }

    function isHealthy() {
        return (health.databaseConnected)
    }

    if (req.url === "/ready") {

        try {
            await prisma.$queryRaw`SELECT 1`
            health.databaseConnected = true;
        } catch {
            health.databaseConnected = false;
        }

        const healthy = isHealthy();

        res.writeHead(healthy ? 200 : 503, {
            "Content-Type": "application/json",
        });

        res.end(JSON.stringify({
            success: true,
            status: healthy ? "ready" : "not-ready",
            databaseConnected: health.databaseConnected,
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
        }))
        return;
    }

    res.writeHead(403);
    res.end();
})



async function main() {

    await initializeRedisStreams();

    await RedisRouter.startRedisListener();
    console.log("Backend Redis response listener started");

    server.listen(PORT, () => {
        console.log(`Database Server listening on port ${PORT}`);
    })

    let shuttingDown = false;

    const shutdown = async (signal: string) => {
        if (shuttingDown) return;
        shuttingDown = true;

        console.log(`${signal} received, shutting down database engine gracefully`);

        RedisRouter.stop();
        server.close();

        try {
            await prisma.$disconnect();
        } catch (error) {
            console.error("Error disconnecting Prisma on shutdown:", error);
        }

        process.exit(0);
    };

    process.on("SIGTERM", () => void shutdown("SIGTERM"));
    process.on("SIGINT", () => void shutdown("SIGINT"));
}

void main().catch((error) => {
    console.error("Failed to start database engine:", error);
    process.exit(1);
});