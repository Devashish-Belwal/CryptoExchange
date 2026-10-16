import { prisma } from "@workspace/database";
import { health } from "./controller/health-controller.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import appRouter from "./routers/index.js";
import createServer from "./server.js";
import envConfig from "./utils/config.js";
import { NotFoundError } from "./utils/errors.js";
import { RedisRouter } from "./utils/redis-router.js";

const app = createServer();

app.use("/api/v1", appRouter);

app.use((req, res, next) => {
    next(new NotFoundError(`Route ${req.originalUrl} not found`));
});

app.use(errorHandler);

async function main() {
    await RedisRouter.startRedisListener();
    console.log("Backend Redis response listener started");

    health.redisConnected = true;

    const server = app.listen(envConfig.PORT, () => {
        console.log(`Server is running on port ${envConfig.PORT}`);
    })

    let shuttingDown = false;

    const shutdown = async (signal: string) => {
        if (shuttingDown) return;
        shuttingDown = true;

        console.log(`${signal} received, shutting down core-backend gracefully`);

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
    console.error("Failed to start core backend:", error);
    process.exit(1);
});