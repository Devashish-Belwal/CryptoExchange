import { OrderPosition, OrderSide } from "./order";

export type UserPositionType = {
    userId: string;
    positionId: string;
    orderId: string;
    symbol: string;
    position: OrderPosition;
    leverage: number
    margin: number;
    averagePrice: number;
    quantity: number;
    liquidationPrice: number;
    bankruptcyPrice: number;
    entryPrice: number;
    upnl: number;
    openAt: number;
}

export type PositionCloseReason = "CLOSED" | "LIQUIDATED" | "ADL";

export type ClosedPositionUpdate = {
    positionId: string;
    userId: string;
    symbol: string;
    side: OrderPosition;
    leverage: number;
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    margin: number;
    realizedPnl: number;
    closeReason: PositionCloseReason;
    openedAt: number;
    closedAt: number;
    bankruptcyPrice: number;
    liquidationPrice: number;
    markPrice: number;
    deficit: number;
    insuranceCovered: number;
}