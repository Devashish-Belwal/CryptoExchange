import { RedisRouter } from "./redis-router";
import { WsGateway } from "./ws-gateway";
import envConfig from "./config";
import http from "node:http";
import dotenv from "dotenv";
dotenv.config();

type HealthState = {
    startedAt: number;
    redisConnected: boolean,
    websocketServerRunning: boolean,
    connectedClients: number;
}

export const health: HealthState = {
    startedAt: Date.now(),
    redisConnected: false,
    websocketServerRunning: false,
    connectedClients: 0
}

function isHealthy() {
    return (health.websocketServerRunning && health.redisConnected)
}

const server = http.createServer((req, res) => {
    if (req.url === "/alive") {
        res.writeHead(200, {
            "Content-Type": "application/json",
        });

        res.end(JSON.stringify({
            success: true,
            status: "alive",
            message: "WS Server is up and running",
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
            websocketConnected: health.websocketServerRunning,
            redisConnected: health.redisConnected,
            connectedClients: health.connectedClients,
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
        }))
        return;
    }

    res.writeHead(403);
    res.end();
})



async function main() {
    const gateway = new WsGateway();
    gateway.start(server, "/ws", envConfig.PORT);

    await RedisRouter.startRedisListener(gateway);
    console.log("Backend Redis response listener started");

    server.listen(envConfig.PORT, () => {
        health.websocketServerRunning = true;
        console.log(`Ws Server listening on port ${envConfig.PORT}`);
    })

    let shuttingDown = false;

    const shutdown = (signal: string) => {
        if (shuttingDown) return;
        shuttingDown = true;

        console.log(`${signal} received, shutting down ws-server gracefully`);

        RedisRouter.stop();
        gateway.close();
        server.close(() => process.exit(0));

        // Force-exit if some connection refuses to drain in time
        setTimeout(() => process.exit(0), 10_000).unref();
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
}

void main().catch((error) => {
    console.error("Failed to start ws-server:", error);
    RedisRouter.stop();
    process.exit(1);
});