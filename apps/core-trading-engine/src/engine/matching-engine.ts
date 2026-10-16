import { CancelOrderRequestPayload, CreateOrderReturnType, DeleteAllOpenOrderRequestPayload, EVENT_REJECT_CODES, GetAllOpenOrderRequestPayload, GetMarketDepthRequestPayload, GetOneOpenOrderRequestPayload, Market, MarketOrderType } from "@workspace/shared";
import { RejectError } from "../utils/error";
import { OrderbookEngine } from "./single-orderbook";
import { BalanceEngine } from "./balance-engine";
import { EngineState } from "./engine-state";
import { orderParseToReturn } from "../utils/parser";

export class MatchingEngine {

    constructor(
        private readonly state: EngineState,
        private readonly balanceEngine: BalanceEngine,
    ) { }

    initializeOrderBook(market: Market) {
        if (this.state.orderbooks.has(market.symbol)) {
            this.reject(EVENT_REJECT_CODES.MARKET_ALREADY_EXISTS, "Orderbook already exists");
        }

        this.state.orderbooks.set(market.symbol, new OrderbookEngine(market, this.balanceEngine, 0));
    }

    createOrder(order: MarketOrderType): {
        order: MarketOrderType;
        cancelledOrders: MarketOrderType[];
        matchedOrders: Map<string, MarketOrderType>;
    } {
        const orderbook = this.state.orderbooks.get(order.symbol);

        if (!orderbook) {
            this.reject(EVENT_REJECT_CODES.INVALID_MARKET, "Orderbook not found");
        }

        const result = orderbook.addOrder(order);

        const oldMarketRisk = this.state.marketRisk.get(order.symbol);

        if (oldMarketRisk) {
            this.state.marketRisk.set(order.symbol, {
                ...oldMarketRisk,
                markPrice: orderbook.lastTradedPrice,
                markUpdatedAt: Date.now(),
            })
        }

        return {
            order: result,
            cancelledOrders: orderbook.consumeCancelledOrders(),
            matchedOrders: orderbook.consumeMatchedOrders()
        }
    }

    cancelOrder(payload: CancelOrderRequestPayload): {
        order: MarketOrderType;
        market: Market
    } {

        const orderbook = this.state.orderbooks.get(payload.symbol);

        if (!orderbook) {
            this.reject(EVENT_REJECT_CODES.INVALID_MARKET, "Orderbook not found");
        }

        const result = orderbook.removeOrder(payload.orderId, payload.userId);

        const oldMarketRisk = this.state.marketRisk.get(payload.symbol);

        if (oldMarketRisk) {
            this.state.marketRisk.set(payload.symbol, {
                ...oldMarketRisk,
                markPrice: orderbook.lastTradedPrice,
                markUpdatedAt: Date.now(),
            })
        }

        return { order: result, market: orderbook.market };
    }

    getOneOpenOrder(payload: GetOneOpenOrderRequestPayload) {
        const orderbook = this.state.orderbooks.get(payload.symbol);

        if (!orderbook) {
            this.reject(EVENT_REJECT_CODES.INVALID_MARKET, "Orderbook not found");
        }

        const orderNode = orderbook.orderMap.get(payload.orderId);

        if (!orderNode) {
            return this.reject(EVENT_REJECT_CODES.ORDER_DONT_EXISTS, "order not found in orderbook")
        }

        const order = orderNode.order;

        if (order.userId !== payload.userId) {
            return this.reject(EVENT_REJECT_CODES.UNAUTHORIZED, "Unauthorized deletion request");
        }

        return order
    }

    getAllOpenOrder(payload: GetAllOpenOrderRequestPayload) {
        const orders: CreateOrderReturnType[] = [];
        const orderbook = this.state.orderbooks.get(payload.symbol);

        if (!orderbook) {
            this.reject(EVENT_REJECT_CODES.INVALID_MARKET, "Orderbook not found");
        }

        const userOrders = orderbook.userOrders.get(payload.userId);

        if (!userOrders) {
            return orders;
        }

        for (const orderId of userOrders.values()) {
            const orderNode = orderbook.orderMap.get(orderId);

            if (!orderNode) {
                return this.reject(EVENT_REJECT_CODES.ORDER_DONT_EXISTS, "order not found in orderbook")
            }


            const order = orderNode.order;

            if (order.userId === payload.userId) {
                orders.push(orderParseToReturn(order));
            }
        }

        return orders;
    }

    deleteAllOpenOrder(payload: DeleteAllOpenOrderRequestPayload) {
        const allOrderId: string[] = [];
        const result: MarketOrderType[] = [];
        const orderbook = this.state.orderbooks.get(payload.symbol);

        if (!orderbook) {
            this.reject(EVENT_REJECT_CODES.INVALID_MARKET, "Orderbook not found");
        }

        const userOrders = orderbook.userOrders.get(payload.userId);

        if (!userOrders || userOrders.size === 0) {
            return { orderId: allOrderId, result, market: orderbook.market };
        }

        for (const orderId of userOrders.values()) {
            const orderNode = orderbook.orderMap.get(orderId);

            if (!orderNode) {
                return this.reject(EVENT_REJECT_CODES.ORDER_DONT_EXISTS, "order not found in orderbook")
            }


            const order = orderNode.order;

            if (order.userId === payload.userId) {
                allOrderId.push(order.orderId);
                result.push(this.cancelOrder(order).order)
            }
        }

        return { orderId: allOrderId, result, market: orderbook.market };
    }

    getMarketDepth(payload: GetMarketDepthRequestPayload) {
        const orderbook = this.state.orderbooks.get(payload.symbol);

        if (!orderbook) {
            this.reject(EVENT_REJECT_CODES.INVALID_MARKET, "Orderbook not found");
        }

        const depths = orderbook.getDepth(payload.limit);

        return { market: orderbook.market, depths }

    }

    getOpenInterest(symbol: string) {
        const orderbook = this.state.orderbooks.get(symbol);

        if (!orderbook) {
            this.reject(EVENT_REJECT_CODES.INVALID_MARKET, "Orderbook not found");
        }

        const data = orderbook.getOpenInterest();

        return data;
    }

    getAllOpenInterest() {
        const marketData = [];

        for (const orderbook of this.state.orderbooks.values()) {
            const data = orderbook.getOpenInterest();
            marketData.push(
                { marketData: data, symbol: orderbook.market.symbol });
        }
        return marketData;
    }

    private reject(code: EVENT_REJECT_CODES, message: string): never {
        throw new RejectError(code, message);
    }
}