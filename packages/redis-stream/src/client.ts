import { createClient, RedisClientType } from "redis";

export type RedisClient = RedisClientType;

const DEFAULT_REDIS_HOST = "localhost";
const DEFAULT_REDIS_PORT = 6379;

class RedisManager {
    private static instance: RedisClient;

    static async getInstance(): Promise<RedisClient> {
        if (!RedisManager.instance) {
            RedisManager.instance = await this.createConnection("command");
        }

        return RedisManager.instance;
    }

    static async createBlockingConnection(name: string): Promise<RedisClient> {
        return RedisManager.createConnection(`blocking:${name}`);
    }

    static async createConnection(name: string): Promise<RedisClient> {
        const host = process.env.REDIS_HOST || DEFAULT_REDIS_HOST;
        const port = RedisManager.resolvePort();
        const password = process.env.REDIS_PASSWORD || undefined;

        const client: RedisClient = createClient({
            socket: { host, port },
            password,
        })

        client.on("connect", () => { console.log(`Redis connected (${name})`) });

        client.on("error", (err) => { console.log(`Redis error (${name})`, err) });

        await client.connect();

        return client;

    }

    private static resolvePort() {
        if (!process.env.REDIS_PORT) { return DEFAULT_REDIS_PORT; }

        const port = Number(process.env.REDIS_PORT);

        if (!Number.isInteger(port) || port < 0 || port >= 65_536) {
            throw new Error(`REDIS_PORT must be an integer between 0 and 65535. Received: ${process.env.REDIS_PORT}`);
        }

        return port;
    }

}

export default RedisManager;