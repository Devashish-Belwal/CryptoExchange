import type { Request, Response } from "express";
import { prisma } from "@workspace/database";
import { ValidationError } from "../utils/errors.js";

const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 1000;

function requireSymbolParam(req: Request): string {
    const { symbol } = req.params;

    if (!symbol || Array.isArray(symbol)) {
        throw new ValidationError("Invalid symbol parameter");
    }

    return symbol;
}

function parseLimit(req: Request): number {
    const { limit } = req.query;

    if (limit === undefined) return DEFAULT_LIMIT;

    if (typeof limit !== "string" || !/^[1-9]\d*$/.test(limit)) {
        throw new ValidationError("Invalid limit parameter");
    }

    return Math.min(Number(limit), MAX_LIMIT);
}

function parseFromId(req: Request): number | undefined {
    const { fromId } = req.query;

    if (fromId === undefined) return undefined;

    if (typeof fromId !== "string" || !/^\d+$/.test(fromId)) {
        throw new ValidationError("Invalid fromId parameter");
    }

    return Number(fromId);
}

type TradeRow = { tradeId: number; price: string; quantity: string; side: string; createdAt: Date };

function toPublicTrade(trade: TradeRow) {
    const quoteQuantity = Number(trade.price) * Number(trade.quantity);

    return {
        id: String(trade.tradeId),
        price: trade.price,
        quantity: trade.quantity,
        quoteQuantity: String(quoteQuantity),
        timestamp: trade.createdAt.getTime(),
        isBuyerMaker: trade.side === "BUY",
    };
}

export const getCurrentMarketTrades = async (req: Request, res: Response) => {
    const symbol = requireSymbolParam(req);
    const limit = parseLimit(req);

    const trades = await prisma.trade.findMany({
        where: { symbol },
        orderBy: { tradeId: "desc" },
        take: limit,
    });

    return res.status(200).json({
        success: true,
        message: "Recent trades fetched successful",
        data: trades.map(toPublicTrade),
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
}

export const getHistoricalMarketTrades = async (req: Request, res: Response) => {
    const symbol = requireSymbolParam(req);
    const limit = parseLimit(req);
    const fromId = parseFromId(req);

    // fromId is a cursor: pass the oldest `id` from the previous page to page further back.
    const trades = await prisma.trade.findMany({
        where: { symbol, ...(fromId !== undefined ? { tradeId: { lte: fromId } } : {}) },
        orderBy: { tradeId: "desc" },
        take: limit,
    });

    return res.status(200).json({
        success: true,
        message: "Historical trades fetched successful",
        data: trades.map(toPublicTrade),
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
}
