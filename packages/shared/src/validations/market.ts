import { z } from "zod";
import { MarketType } from "../types/order";

export const createMarketSchema = z.object({
    symbol: z
        .string()
        .trim()
        .min(1, { error: "Market symbol is required" })
        .max(30, { error: "Market symbol cannot exceed 30 characters" })
        .regex(/^[A-Z_]+$/, {
            error: "Market symbol must contain only uppercase letters or '_'",
        }),

    name: z
        .string()
        .trim()
        .min(1, { error: "Market name is required" })
        .max(100, { error: "Market name cannot exceed 100 characters" }),

    marketType: z.enum(MarketType, {
        error: "Invalid market type",
    }),

    baseAssetSymbol: z
        .string().trim()
        .min(1, { error: "Base symbol is required" })
        .max(30, { error: "Base symbol cannot exceed 30 characters" })
        .regex(/^[A-Z]+$/, {
            error: "Base symbol must contain only uppercase letters.",
        }),

    quoteAssetSymbol: z
        .string().trim()
        .min(1, { error: "Quote symbol is required" })
        .max(30, { error: "Quote symbol cannot exceed 30 characters" })
        .regex(/^[A-Z]+$/, {
            error: "Quote symbol must contain only uppercase letters.",
        }),

    maxLeverage: z
        .number()
        .int({ error: "Max leverage must be an integer" })
        .min(1, { error: "Max leverage must be at least 1" })
        .max(100, { error: "Max leverage cannot exceed 100" })
        .default(1),

    minNotional: z
        .number()
        .int({ error: "Max leverage must be an integer" })
        .min(1, { error: "Max leverage must be at least 1" })
        .max(100, { error: "Max leverage cannot exceed 100" })
        .default(1),

    minQty: z
        .string()
        .regex(/^\d+(\.\d+)?$/, {
            error: "Min order size must be a valid decimal number",
        }),

    tickSize: z
        .string()
        .regex(/^\d+(\.\d+)?$/, {
            error: "Tick size must be a valid decimal number",
        }),

    lotSize: z
        .string()
        .regex(/^\d+(\.\d+)?$/, {
            error: "Lot size must be a valid decimal number",
        }),

    isActive: z.boolean().optional(),
});

export const updateMarketSchema = createMarketSchema
    .partial()
    .refine((data) => Object.keys(data).length > 0, {
        error: "At least one field must be provided for update",
    });

