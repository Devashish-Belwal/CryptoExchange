import type { Request, Response } from "express";
import { prisma } from "@workspace/database";
import { AuthenticationError, NotFoundError, ValidationError } from "../utils/errors.js";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function parsePagination(req: Request): { take: number; skip: number } {
    const { limit, offset } = req.query;

    let take = DEFAULT_LIMIT;

    if (limit !== undefined) {
        if (typeof limit !== "string" || !/^[1-9]\d*$/.test(limit)) {
            throw new ValidationError("Invalid limit parameter");
        }

        take = Math.min(Number(limit), MAX_LIMIT);
    }

    let skip = 0;

    if (offset !== undefined) {
        if (typeof offset !== "string" || !/^\d+$/.test(offset)) {
            throw new ValidationError("Invalid offset parameter");
        }

        skip = Number(offset);
    }

    return { take, skip };
}

function parseOrderId(req: Request): string | undefined {
    const { orderId } = req.query;

    if (orderId === undefined) return undefined;

    if (typeof orderId !== "string" || orderId.length === 0) {
        throw new ValidationError("Invalid orderId parameter");
    }

    return orderId;
}

export const getUserTradesHistory = async (req: Request, res: Response) => {
    const userId = req.userId;

    if (!userId) throw new AuthenticationError("User authentication required");

    const orderId = parseOrderId(req);
    const { take, skip } = parsePagination(req);

    const userLegs = orderId
        ? [{ takerOrderId: orderId, takerUserId: userId }, { makerOrderId: orderId, makerUserId: userId }]
        : [{ takerUserId: userId }, { makerUserId: userId }];

    const trades = await prisma.trade.findMany({
        where: { OR: userLegs },
        orderBy: { createdAt: "desc" },
        take,
        skip,
    });

    return res.status(200).json({
        success: true,
        message: "Fill history fetched successful",
        data: { trades, pagination: { limit: take, offset: skip, count: trades.length } },
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
}

export const getUserOrdersHistory = async (req: Request, res: Response) => {
    const userId = req.userId;

    if (!userId) throw new AuthenticationError("User authentication required");

    const orderId = parseOrderId(req);

    if (orderId) {
        const order = await prisma.order.findFirst({ where: { userId, orderId } });

        if (!order) throw new NotFoundError(`Order with id ${orderId} not found`);

        return res.status(200).json({
            success: true,
            message: "Order fetched successful",
            data: { order },
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
        });
    }

    const { take, skip } = parsePagination(req);

    const orders = await prisma.order.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take,
        skip,
    });

    return res.status(200).json({
        success: true,
        message: "Order history fetched successful",
        data: { orders, pagination: { limit: take, offset: skip, count: orders.length } },
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
}

function parseSymbol(req: Request): string | undefined {
    const { symbol } = req.query;

    if (symbol === undefined) return undefined;

    if (typeof symbol !== "string" || symbol.length === 0) {
        throw new ValidationError("Invalid symbol parameter");
    }

    return symbol;
}

export const getUserPositionsHistory = async (req: Request, res: Response) => {
    const userId = req.userId;

    if (!userId) throw new AuthenticationError("User authentication required");

    const symbol = parseSymbol(req);
    const { take, skip } = parsePagination(req);

    const positions = await prisma.position.findMany({
        where: { userId, ...(symbol ? { symbol } : {}) },
        include: { liquidation: true },
        orderBy: { closedAt: "desc" },
        take,
        skip,
    });

    return res.status(200).json({
        success: true,
        message: "Position history fetched successful",
        data: { positions, pagination: { limit: take, offset: skip, count: positions.length } },
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
}

export const getUserBalanceLedger = async (req: Request, res: Response) => {
    const userId = req.userId;

    if (!userId) throw new AuthenticationError("User authentication required");

    const symbol = parseSymbol(req);
    const { take, skip } = parsePagination(req);

    const transactions = await prisma.balanceTransaction.findMany({
        where: { userId, ...(symbol ? { symbol } : {}) },
        orderBy: { createdAt: "desc" },
        take,
        skip,
    });

    return res.status(200).json({
        success: true,
        message: "Balance ledger fetched successful",
        data: { transactions, pagination: { limit: take, offset: skip, count: transactions.length } },
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
}
