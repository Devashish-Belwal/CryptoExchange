import { json, urlencoded } from "body-parser";
import { type Express } from "express";
import express from "express";
import morgan from "morgan";
import cors from "cors";
import cookieParser from "cookie-parser";
import envConfig from "./utils/config.js";

const ALLOWED_ORIGINS = envConfig.FRONTEND_URL
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const createServer = (): Express => {
    const app = express();

    app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"))
        .use(urlencoded({ extended: true }))
        .use(json())
        .use(cors({
            origin(origin, callback) {
                // Allow server-to-server requests, curl, health checks, etc. (no Origin header)
                if (!origin) return callback(null, true);

                if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);

                return callback(new Error(`CORS blocked for origin: ${origin}`));
            },
            credentials: true,
        }))
        .use(cookieParser());

    return app;
}

export default createServer;