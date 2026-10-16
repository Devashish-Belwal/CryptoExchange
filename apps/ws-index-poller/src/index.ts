import { WsPollerHealthState } from "@workspace/shared";
import dotenv from "dotenv";
dotenv.config();
import http from "node:http";
import { publishFundingSettlements } from "./redis-router";
import { connect, disconnect } from "./ws";

export const health: WsPollerHealthState = {
    websocketConnected: false,
    lastMessageAt: 0,
    redisHealthy: false,
    startedAt: Date.now()
}

const HTTP_PORT = process.env.PORT ? Number(process.env.PORT) : 8084;
const STALE_MS = process.env.STALE_AFTER_MS ? Number(process.env.STALE_AFTER_MS) : 10_000;

function isHealthy() {
    return (
        health.websocketConnected &&
        Date.now() - health.lastMessageAt < STALE_MS &&
        health.redisHealthy
    )
}

const server = http.createServer((req, res) => {
    if (req.url === "/alive") {
        res.writeHead(200, {
            "Content-Type": "application/json",
        });

        res.end(JSON.stringify({
            success: true,
            status: "alive",
            message: "WS poller service is up and running",
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
            websocketConnected: health.websocketConnected,
            redisHealthy: health.redisHealthy,
            lastMessageAge: Date.now() - health.lastMessageAt,
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
        }))

        return;
    }

    res.writeHead(404);
    res.end();
})

export const FUNDING_INTERVAL_SECONDS = Number(process.env.FUNDING_INTERVAL_SECONDS ?? 3_600);


export function startIndexPoller() {
    if (!Number.isInteger(FUNDING_INTERVAL_SECONDS) || FUNDING_INTERVAL_SECONDS <= 0) {
        throw new Error("FUNDING_INTERVAL_SECONDS must be a positive integer");
    }

    // For funding rate trigger
    const fundingInterval = setInterval(publishFundingSettlements, FUNDING_INTERVAL_SECONDS * 1000);

    connect();

    server.listen(HTTP_PORT, () => {
        console.log(`Ws poller server listening on port ${HTTP_PORT}`);

    });

    let shuttingDown = false;

    const shutdown = (signal: string) => {
        if (shuttingDown) return;
        shuttingDown = true;

        console.log(`${signal} received, shutting down ws-index-poller gracefully`);

        clearInterval(fundingInterval);
        disconnect();
        server.close(() => process.exit(0));

        setTimeout(() => process.exit(0), 10_000).unref();
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
}

startIndexPoller();