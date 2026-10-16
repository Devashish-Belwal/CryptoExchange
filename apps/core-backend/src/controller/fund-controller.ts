import type { Request, Response } from "express";
import { prisma } from "@workspace/database";
import { ValidationError } from "../utils/errors.js";

export const getAllFunds = async (req: Request, res: Response) => {
    const funds = await prisma.fund.findMany({
        orderBy: [{ symbol: "asc" }, { type: "asc" }],
    });

    return res.status(200).json({
        success: true,
        message: "Funds fetched successful",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        data: { funds },
    });
}

export const getFundsBySymbol = async (req: Request, res: Response) => {
    const { symbol } = req.params;

    if (!symbol || Array.isArray(symbol)) {
        throw new ValidationError("Invalid symbol parameter");
    }

    const funds = await prisma.fund.findMany({
        where: { symbol },
        orderBy: { type: "asc" },
    });

    return res.status(200).json({
        success: true,
        message: "Funds fetched successful",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        data: { funds },
    });
}
