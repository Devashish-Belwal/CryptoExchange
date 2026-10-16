import { z } from "zod";
import { MarketType, OrderSide, OrderType, STPMode, TimeInForce } from "../types/order";

export const DecimalStringSchema = z
    .string()
    .trim()
    .min(1, "Value is required")
    .regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/, {
        message: "Must be a valid positive number",
    })
    .refine((value) => Number(value) > 0, {
        message: "Value must be greater than 0",
    });

export const CreateOrderClientSchema = z.object({
    symbol: z.string().trim().min(1, "Market is required"),
    entryPrice: DecimalStringSchema,
    quantity: DecimalStringSchema,
    leverage: z
        .number()
        .int("Leverage must be a whole number")
        .min(1, "Leverage must be at least 1")
        .max(100, "Leverage cannot be greater than 100"),

    side: z.enum([OrderSide.BUY, OrderSide.SELL], { message: "Invalid order side", }),

    marketType: z.enum([MarketType.PERP, MarketType.SPOT], { message: "Invalid market type", }),

    type: z.enum([OrderType.LIMIT, OrderType.MARKET], { message: "Invalid order type", }),

    postOnly: z.boolean(),

    reduceOnly: z.boolean(),

    stpMode: z.enum([STPMode.CANCEL_BOTH, STPMode.CANCEL_MAKER, STPMode.CANCEL_TAKER,], { message: "Invalid STP mode", }),

    timeInForce: z.enum([TimeInForce.FOK, TimeInForce.GTC, TimeInForce.IOC,], { message: "Invalid time in force", }
    ),
})
