import { FillStatus, OrderSide } from "./order";

export interface FillType {
    price: string;
    qty: string;
    symbol: string;
    tradeId: number,
    takerOrderId: string,
    takerUserId: string;
    makerOrderId: string,
    makerUserId: string,
    side: OrderSide,
    status: FillStatus;
    timestamp: number;
    takerFee: string;
    makerFee: string;
}

export interface InMarketFillType {
    price: number;
    qty: number;
    symbol: string,
    tradeId: number,
    takerOrderId: string,
    takerUserId: string;
    makerOrderId: string,
    makerUserId: string,
    side: OrderSide,
    status: FillStatus;
    timestamp: number;
    takerFee: number;
    makerFee: number;
}

export type orderDepthChange = {
    bids: [string, string][];
    asks: [string, string][];
}

export type InMarketDepthChange = {
    bids: { price: number, quantity: number }[];
    asks: { price: number, quantity: number }[];
}

export type DepthUpdate = orderDepthChange & {
    symbol: string;
};

