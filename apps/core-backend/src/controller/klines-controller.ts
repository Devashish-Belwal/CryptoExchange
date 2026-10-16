import type { Request, Response } from "express";
import { prisma, Prisma } from "@workspace/database";
import { ValidationError } from "../utils/errors.js";

const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 1000;
const DEFAULT_OFFSET = 0;

const INTERVAL_VIEWS: Record<string, string | null> = {
    "1s": null,
    "1m": "kline_candles_1m",
    "5m": "kline_candles_5m",
    "15m": "kline_candles_15m",
    "30m": "kline_candles_30m",
    "1h": "kline_candles_1h",
    "4h": "kline_candles_4h",
    "1d": "kline_candles_1d",
    "1w": "kline_candles_1w",
};

function requireSymbolParam(req: Request): string {
    const { symbol } = req.params;

    if (!symbol || Array.isArray(symbol)) {
        throw new ValidationError("Invalid symbol parameter");
    }

    return symbol;
}

function parseInterval(req: Request): string {
    const { interval } = req.query;

    if (typeof interval !== "string" || !(interval in INTERVAL_VIEWS)) {
        throw new ValidationError(
            `Invalid interval parameter. Supported intervals: ${Object.keys(INTERVAL_VIEWS).join(", ")}`
        );
    }

    return interval;
}

function parseLimit(req: Request): number {
    const { limit } = req.query;

    if (limit === undefined) return DEFAULT_LIMIT;

    if (typeof limit !== "string" || !/^[1-9]\d*$/.test(limit)) {
        throw new ValidationError("Invalid limit parameter");
    }

    return Math.min(Number(limit), MAX_LIMIT);
}

function parseOffset(req: Request): number {
    const { offset } = req.query;

    // No offset sent -> first page, most recent candles.
    if (offset === undefined) return DEFAULT_OFFSET;

    if (typeof offset !== "string" || !/^\d+$/.test(offset)) {
        throw new ValidationError("Invalid offset parameter");
    }

    return Number(offset);
}

type KlineRow = {
    bucket: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    trade_count: number | bigint | string;
};

function toPublicKline(row: KlineRow) {
    return {
        openTime: row.bucket.getTime(),
        open: String(row.open),
        high: String(row.high),
        low: String(row.low),
        close: String(row.close),
        volume: String(row.volume),
        trades: Number(row.trade_count),
    };
}

export const getMarketKlines = async (req: Request, res: Response) => {
    const symbol = requireSymbolParam(req);
    const interval = parseInterval(req);
    const limit = parseLimit(req);
    const offset = parseOffset(req);

    const view = INTERVAL_VIEWS[interval];

    // Rows come back newest-first so LIMIT/OFFSET pages "further back in
    // time" as the client increases offset, then get reversed to
    // oldest-first -- the order charting libraries expect.
    const rows = view
        ? await prisma.$queryRaw<KlineRow[]>(
            Prisma.sql`
                SELECT bucket, open, high, low, close, volume, trade_count
                FROM ${Prisma.raw(view)}
                WHERE symbol = ${symbol}
                ORDER BY bucket DESC
                LIMIT ${limit} OFFSET ${offset}
            `
        )
        : await prisma.$queryRaw<KlineRow[]>(
            Prisma.sql`
                SELECT
                    time_bucket('1 second', "createdAt") AS bucket,
                    first(price::numeric, "createdAt")   AS open,
                    max(price::numeric)                  AS high,
                    min(price::numeric)                  AS low,
                    last(price::numeric, "createdAt")    AS close,
                    sum(quantity::numeric)                AS volume,
                    count(*)                              AS trade_count
                FROM "Trade"
                WHERE symbol = ${symbol} AND "createdAt" > now() - interval '1 hour'
                GROUP BY bucket
                ORDER BY bucket DESC
                LIMIT ${limit} OFFSET ${offset}
            `
        );

    const data = rows.map(toPublicKline).reverse();

    return res.status(200).json({
        success: true,
        message: "Klines fetched successful",
        data,
        pagination: {
            interval,
            limit,
            offset,
            nextOffset: offset + rows.length,
        },
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
}
