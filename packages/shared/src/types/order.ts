import { BalanceLedger, InMarketBalanceLedger } from "./balance";
import { FillType, InMarketDepthChange, InMarketFillType, orderDepthChange } from "./depth";

export enum OrderStatus {
    OPEN = "OPEN",
    PARTIAL_FILLED = "PARTIAL_FILLED",
    PARTIAL_REJECTED = "PARTIAL_REJECTED",
    FILLED = "FILLED",
    CANCELLED = "CANCELLED",
    REJECTED = "REJECTED"
}

export enum OrderType {
    LIMIT = "LIMIT",
    MARKET = "MARKET"
}

export enum OrderSide {
    BUY = "BUY",
    SELL = "SELL"
}

export enum OrderPosition {
    LONG = "LONG",
    SHORT = "SHORT"
}

export enum STPMode {
    CANCEL_MAKER = "CANCEL_MAKER",
    CANCEL_TAKER = "CANCEL_TAKER",
    CANCEL_BOTH = "CANCEL_BOTH"
}

export enum TimeInForce {
    GTC = "Good_Till_Cancel",
    IOC = "Immediate_OR_Return",
    FOK = "Fill_OR_KILL",
}

export enum MarketType {
    SPOT = "SPOT",
    PERP = "PERP"
}

export enum FillStatus {
    TRADE = "TRADE",
    STP = "STP"
}

export type MarketOrderType = {
    symbol: string;
    userId: string;
    entryPrice: number;
    quantity: number;
    side: OrderSide;
    type: OrderType;
    postOnly: boolean;
    stpMode: STPMode;
    marketType: MarketType;
    timeInForce: TimeInForce;
    createdAt: number;
    orderId: string;
    remainingQuantity: number;
    filledQuantity: number;
    averagePrice: number;
    balance: InMarketBalanceLedger;
    status: OrderStatus;
    depth: InMarketDepthChange
    fills: InMarketFillType[];
    liquidation?: boolean;
    leverage?: number;
    margin?: number;
    reduceOnly?: boolean;
}

export type PerpMarketOrderType = {
    symbol: string;
    userId: string;
    entryPrice: number;
    quantity: number;
    position: OrderPosition;
    type: OrderType;
    postOnly: boolean;
    stpMode: STPMode;
    marketType: MarketType;
    timeInForce: TimeInForce;
    createdAt: number;
    orderId: string;
    remainingQuantity: number;
    filledQuantity: number;
    averagePrice: number;
    balance: InMarketBalanceLedger;
    status: OrderStatus;
    liquidation: boolean;
    leverage: number;
    margin: number;
    reduceOnly: boolean;
    adl?: boolean;
    depth: InMarketDepthChange
    fills: InMarketFillType[];
}

export type CreateOrderReturnType = {
    symbol: string;
    userId: string;
    entryPrice: string;
    quantity: string;
    side: OrderSide;
    type: OrderType;
    postOnly: boolean;
    stpMode: STPMode;
    marketType: MarketType;
    timeInForce: TimeInForce;
    createdAt: number;
    orderId: string;
    remainingQuantity: string;
    filledQuantity: string;
    averagePrice: string;
    balance: BalanceLedger;
    status: OrderStatus;
    depth: orderDepthChange;
    fills: FillType[];
    leverage?: number;
    margin?: string;
    reduceOnly?: boolean;
}