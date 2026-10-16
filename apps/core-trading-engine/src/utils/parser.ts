import { CreateOrderRequestPayload, CreateOrderReturnType, FillType, InMarketDepthChange, InMarketFillType, MarketOrderType, MarketType, orderDepthChange, OrderStatus } from "@workspace/shared";
import { v4 as uuidv4 } from "uuid";

export function orderParseToMarket(payload: CreateOrderRequestPayload): MarketOrderType {
    return {
        ...payload,
        orderId: uuidv4(),
        status: OrderStatus.OPEN,
        entryPrice: Number(payload.entryPrice),
        quantity: Number(payload.quantity),
        remainingQuantity: Number(payload.quantity),
        filledQuantity: 0,
        averagePrice: 0,
        leverage: payload.leverage,
        margin: payload.marketType === MarketType.PERP ? 0 : undefined,
        liquidation: payload.marketType === MarketType.PERP ? payload.liquidation !== undefined ? payload.liquidation : false : undefined,
        balance: {
            allotted: 0,
            used: 0,
            released: 0,
        },
        depth: {
            bids: [],
            asks: []
        },
        fills: []
    }
}

export function orderParseToReturn(payload: MarketOrderType): CreateOrderReturnType {
    return {
        ...payload,
        entryPrice: String(payload.entryPrice),
        quantity: String(payload.quantity),
        remainingQuantity: String(payload.remainingQuantity),
        filledQuantity: String(payload.filledQuantity),
        averagePrice: String(payload.averagePrice),
        margin: payload.marketType === MarketType.PERP ? String(payload.margin) : undefined,
        balance: {
            allotted: String(payload.balance.allotted),
            used: String(payload.balance.used),
            released: String(payload.balance.released),
        },
        depth: parseOrderDepth(payload.depth),
        fills: parseOrderFills(payload.fills)

    }

}

export function parseOrderFills(fills: InMarketFillType[]): FillType[] {
    return fills.map(({ price, qty, takerFee, makerFee, ...rest }) => ({
        ...rest,
        price: String(price),
        qty: String(qty),
        takerFee: String(takerFee),
        makerFee: String(makerFee),
    }));
}

export function parseOrderDepth(depth: InMarketDepthChange): orderDepthChange {
    return {
        bids: depth.bids.map<[string, string]>(({ price, quantity }) => [
            String(price),
            String(quantity),
        ]),

        asks: depth.asks.map<[string, string]>(({ price, quantity }) => [
            String(price),
            String(quantity),
        ]),
    };
}
