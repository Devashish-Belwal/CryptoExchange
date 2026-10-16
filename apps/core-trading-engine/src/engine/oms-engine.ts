import { AddAssetRequestPayload, AddMarketRequestPayload, CancelOrderRequestPayload, DeleteAssetRequestPayload, DeleteMarketRequestPayload, EVENT_REJECT_CODES, Market, MarketOrderType, MarketType, OnRampBalanceRequestPayload, OrderPosition, OrderSide, OrderType, TimeInForce, UpdateAssetRequestPayload, UpdateMarketRequestPayload } from "@workspace/shared";
import { EngineState } from "./engine-state";
import { RejectError } from "../utils/error";
import { OrderbookEngine } from "./single-orderbook";
import { OrderList, remaining } from "../utils/order-list";

export class OMSEngine {
    constructor(private readonly state: EngineState) { }

    addAsset(payload: AddAssetRequestPayload) {
        const isExists = this.state.assets.has(payload.symbol);

        if (isExists) return this.reject(EVENT_REJECT_CODES.ASSET_ALREADY_EXISTS, "The asset already exists in the market");

        if (payload.precision < 0) {
            return this.reject(EVENT_REJECT_CODES.INVALID_ASSET_UPDATE, "The asset precision pointer can not be less than 0");
        }

        if (payload.name.length <= 0) {
            return this.reject(EVENT_REJECT_CODES.INVALID_ASSET_UPDATE, "The asset precision pointer can not be less than 0");
        }
    }

    updateAsset(payload: UpdateAssetRequestPayload) {
        const isExists = this.state.assets.has(payload.symbol);

        if (!isExists) return this.reject(EVENT_REJECT_CODES.ASSET_NOT_EXISTS, "The asset does not exists in the market");

        if (payload.precision && payload.precision < 0) {
            return this.reject(EVENT_REJECT_CODES.INVALID_ASSET_UPDATE, "The asset precision pointer can not be less than 0");
        }

        if (payload.name && payload.name.length <= 0) {
            return this.reject(EVENT_REJECT_CODES.INVALID_ASSET_UPDATE, "The asset precision pointer can not be less than 0");
        }
    }

    deleteAsset(payload: DeleteAssetRequestPayload) {
        const isExists = this.state.assets.has(payload.symbol);

        if (!isExists) return this.reject(EVENT_REJECT_CODES.ASSET_NOT_EXISTS, "The asset does not exists in the market");

        for (const market of this.state.markets.values()) {
            if (market.baseAsset.symbol === payload.symbol ||
                market.quoteAsset.symbol === payload.symbol
            ) {
                return this.reject(EVENT_REJECT_CODES.INVALID_ASSET_UPDATE, "The asset is still in use and cannot be deleted");
            }
        }
    }

    addMarket(payload: AddMarketRequestPayload) {
        if (!payload.userId) {
            return this.reject(EVENT_REJECT_CODES.INVALID_USER_ID, "User ID is required");
        }

        if (!payload.symbol) {
            return this.reject(EVENT_REJECT_CODES.INVALID_SYMBOL, "Market symbol is required");
        }

        if (!payload.baseAssetSymbol) {
            return this.reject(EVENT_REJECT_CODES.INVALID_ASSET, "Base asset is required");
        }

        if (!payload.quoteAssetSymbol) {
            return this.reject(EVENT_REJECT_CODES.INVALID_ASSET, "Quote asset is required");
        }

        if (payload.baseAssetSymbol === payload.quoteAssetSymbol) {
            return this.reject(
                EVENT_REJECT_CODES.INVALID_ASSET_PAIR,
                "Base asset and quote asset cannot be the same"
            );
        }

        if (payload.maxLeverage <= 0) {
            return this.reject(
                EVENT_REJECT_CODES.INVALID_MAX_LEVERAGE,
                "Max leverage must be greater than 0"
            );
        }

        if (Number(payload.minQty) <= 0) {
            return this.reject(
                EVENT_REJECT_CODES.INVALID_MIN_QTY,
                "Minimum quantity must be greater than 0"
            );
        }

        if (Number(payload.tickSize) <= 0) {
            return this.reject(
                EVENT_REJECT_CODES.INVALID_TICK_SIZE,
                "Tick size must be greater than 0"
            );
        }

        if (Number(payload.lotSize) <= 0) {
            return this.reject(
                EVENT_REJECT_CODES.INVALID_LOT_SIZE,
                "Lot size must be greater than 0"
            );
        }

        if (payload.minNotional <= 0) {
            return this.reject(
                EVENT_REJECT_CODES.INVALID_MIN_NOTIONAL,
                "Minimum notional must be greater than 0"
            );
        }

        if (this.state.markets.has(payload.symbol)) {
            return this.reject(
                EVENT_REJECT_CODES.MARKET_ALREADY_EXISTS,
                "The market already exists in the engine"
            );
        }
    }

    updateMarket(payload: UpdateMarketRequestPayload) {
        if (!payload.userId) {
            return this.reject(EVENT_REJECT_CODES.INVALID_USER_ID, "User ID is required");
        }

        if (!payload.symbol) {
            return this.reject(EVENT_REJECT_CODES.INVALID_SYMBOL, "Market symbol is required");
        }

        const market = this.state.markets.get(payload.symbol);

        if (!market) {
            return this.reject(EVENT_REJECT_CODES.MARKET_NOT_FOUND, "Market does not exist");
        }

        if (payload.maxLeverage !== undefined && payload.maxLeverage <= 0) {
            return this.reject(EVENT_REJECT_CODES.INVALID_MAX_LEVERAGE, "Max leverage must be greater than 0");
        }

        if (payload.minQty !== undefined && Number(payload.minQty) <= 0) {
            return this.reject(EVENT_REJECT_CODES.INVALID_MIN_QTY, "Minimum quantity must be greater than 0");
        }

        if (payload.tickSize !== undefined && Number(payload.tickSize) <= 0) {
            return this.reject(EVENT_REJECT_CODES.INVALID_TICK_SIZE, "Tick size must be greater than 0");
        }

        if (payload.lotSize !== undefined && Number(payload.lotSize) <= 0) {
            return this.reject(EVENT_REJECT_CODES.INVALID_LOT_SIZE, "Lot size must be greater than 0");
        }

        if (payload.minNotional !== undefined && payload.minNotional <= 0) {
            return this.reject(EVENT_REJECT_CODES.INVALID_MIN_NOTIONAL, "Minimum notional must be greater than 0");
        }

        if (payload.name !== undefined && payload.name.trim().length === 0) {
            return this.reject(EVENT_REJECT_CODES.INVALID_MARKET, "Market name cannot be empty");
        }

        const minQty = payload.minQty !== undefined ? Number(payload.minQty) : market.minQty;
        const lotSize = payload.lotSize !== undefined ? Number(payload.lotSize) : market.lotSize;

        if (minQty < lotSize) {
            return this.reject(EVENT_REJECT_CODES.INVALID_MIN_QTY, "Minimum quantity cannot be less than lot size");
        }

        if (!this.isStepAligned(minQty, lotSize)) {
            return this.reject(EVENT_REJECT_CODES.INVALID_MIN_QTY, "Minimum quantity must be a multiple of lot size");
        }

    }

    deleteMarket(payload: DeleteMarketRequestPayload) {
        const orderbook = this.state.orderbooks.get(payload.symbol);

        if (orderbook && !orderbook.isEmpty()) {
            this.reject(EVENT_REJECT_CODES.MARKET_IS_BUSY, "The markets with open order cannot be deleted")

        }
    }

    RampBalance(payload: OnRampBalanceRequestPayload) {
        if (Number(payload.amount) <= 0) {
            return this.reject(EVENT_REJECT_CODES.INVALID_AMOUNT, "The amount can not not be less than zero")
        }

        const isAssetExists = this.state.assets.has(payload.symbol);

        if (!isAssetExists) {
            return this.reject(EVENT_REJECT_CODES.ASSET_NOT_EXISTS, "The asset does not exists in the market")
        }
    }

    createOrderCheck(order: MarketOrderType) {

        const market = this.validateMarket(order.symbol);

        this.validateBasicOrder(order);

        this.validateTIF(order);

        this.validateMarketConstraints(order, market);

        this.validatePositionRule(order);

        this.validateOrderbookRules(order);

        this.validateRiskRules(order, market);

    }

    cancelOrderCheck(payload: CancelOrderRequestPayload) {
        const market = this.validateMarket(payload.symbol);

        const orderbook = this.state.orderbooks.get(market.symbol);

        if (!orderbook) {
            return this.reject(EVENT_REJECT_CODES.ORDER_DONT_EXISTS, "Cannot find order book for this order");
        }

        const orderSet = orderbook.userOrders.get(payload.userId);

        if (!orderSet) {
            return this.reject(EVENT_REJECT_CODES.ORDER_DONT_EXISTS, "No order found for the user in the market");
        }

        if (!orderSet.has(payload.orderId)) {
            return this.reject(EVENT_REJECT_CODES.ORDER_DONT_EXISTS, "No such order found for the user in the market");
        }
    }

    validateMarket(symbol: string): Market {
        const market = this.state.markets.get(symbol);

        if (!market) return this.reject(EVENT_REJECT_CODES.INVALID_MARKET, "The market symbol is not supported");

        return market;
    }

    validateUser(userId: string) {
        const isUserExists = this.state.balances.has(userId);

        if (!isUserExists) return this.reject(EVENT_REJECT_CODES.USER_DOESNT_EXISTS, "The user does'nt exists in the engine database");
    }

    private validateBasicOrder(order: MarketOrderType) {
        if (order.side !== OrderSide.BUY && order.side !== OrderSide.SELL) {
            this.reject(EVENT_REJECT_CODES.INVALID_SIDE, "The order side is neither buy nor sell");
        }

        if (order.type !== OrderType.LIMIT && order.type !== OrderType.MARKET) {
            this.reject(EVENT_REJECT_CODES.INVALID_TYPE, "The order type in neither limit nor market");
        }

        if (order.quantity <= 0) {
            this.reject(EVENT_REJECT_CODES.INVALID_QUANTITY, "Order quantity can't be negetive");
        }

        if (order.entryPrice <= 0) {
            this.reject(EVENT_REJECT_CODES.INVALID_PRICE, "Order price can't be negetive");
        }

        if (order.marketType === MarketType.PERP) {

            if (order.leverage === undefined) {
                return this.reject(EVENT_REJECT_CODES.INVALID_LEVERAGE, "Leverage should be available in perps order");
            }

            if (order.leverage && order.leverage <= 0) {
                return this.reject(EVENT_REJECT_CODES.INVALID_LEVERAGE, "Leverage cant be negetive");
            }

            if (order.reduceOnly === undefined) {
                return this.reject(EVENT_REJECT_CODES.INVALID_REDUCE_ONLY, "reduce only key is required");
            }

            if (order.margin === undefined) {
                return this.reject(EVENT_REJECT_CODES.INVALID_MARGIN, "Margin key is required");
            }

            if (order.liquidation === undefined) {
                return this.reject(EVENT_REJECT_CODES.INVALID_LIQUIDATION, "Liquidation key is required");
            }
        }
    }

    private validateTIF(order: MarketOrderType) {
        if (order.type === OrderType.MARKET && order.timeInForce === TimeInForce.GTC) {
            return this.reject(EVENT_REJECT_CODES.MARKET_ORDER_GTC, "Market orders cannot use GTC");
        }
    }

    private validateMarketConstraints(order: MarketOrderType, market: Market) {
        if (order.marketType === MarketType.PERP) {
            if (order.leverage && order.leverage > market.maxLeverage) {
                return this.reject(EVENT_REJECT_CODES.LEVERAGE_EXCEEDED, "Leverage exceeds market limit");
            }
        }

        if (order.quantity < market.minQty) {
            return this.reject(EVENT_REJECT_CODES.BELOW_MIN_QTY, "Quantity below minimum");
        }

        if (market.lotSize <= 0 || !this.isStepAligned(order.quantity, market.lotSize)) {
            return this.reject(EVENT_REJECT_CODES.INVALID_LOT_SIZE, "Invalid lot size");
        }

        if (order.type === OrderType.LIMIT) {
            if (market.tickSize <= 0 || !this.isStepAligned(order.entryPrice, market.tickSize)) {
                return this.reject(EVENT_REJECT_CODES.INVALID_TICK_SIZE, "Invalid tick size");
            }
        }

        if ((order.quantity * order.entryPrice) < market.minNotional) {
            return this.reject(EVENT_REJECT_CODES.BELOW_MIN_NOTIONAL, "Below minimum notional");
        }
    }

    private validatePositionRule(order: MarketOrderType) {
        if (order.marketType !== MarketType.PERP) {
            return;
        }

        const marketPositions = this.state.positions.get(order.symbol);

        if (!marketPositions) {
            return;
        }

        const positionId = marketPositions.positionByUserId.get(order.userId);

        if (!positionId) {
            if (order.reduceOnly) {
                return this.reject(EVENT_REJECT_CODES.REDUCE_ONLY_INVALID, "No position exists to reduce");
            }
            return;
        }

        const position = marketPositions.positionById.get(positionId);

        if (!position) {
            if (order.reduceOnly) {
                return this.reject(EVENT_REJECT_CODES.REDUCE_ONLY_INVALID, "No position exists to reduce");
            }
            return;
        }

        if (order.reduceOnly) {
            const orderPosition = order.side === OrderSide.BUY ? OrderPosition.LONG : OrderPosition.SHORT;
            if (position.position === orderPosition) {
                return this.reject(EVENT_REJECT_CODES.REDUCE_ONLY_INVALID, "Reduce only order increases exposure");
            }

            if (order.quantity > position.quantity) {
                return this.reject(EVENT_REJECT_CODES.REDUCE_ONLY_INVALID, "Reduce only order exceeds open position");
            }

            if (order.type === OrderType.LIMIT && order.timeInForce === TimeInForce.GTC) {
                return this.reject(EVENT_REJECT_CODES.REDUCE_ONLY_INVALID, "Reduce only orders cannot rest");
            }

        }

    }

    private validateOrderbookRules(order: MarketOrderType) {
        const orderbook = this.state.orderbooks.get(order.symbol);

        if (!orderbook) {
            return this.reject(EVENT_REJECT_CODES.INVALID_MARKET, "Orderbook missing");
        }

        const userOrders = orderbook.userOrders.get(order.userId);

        if (userOrders && userOrders.size >= 100) {
            return this.reject(EVENT_REJECT_CODES.MAX_OPEN_ORDERS, "Too many open orders");
        }

        if (order.postOnly && order.type === OrderType.LIMIT) {
            const bestAsk = this.getBestAsk(orderbook);
            const bestBid = this.getBestBid(orderbook);

            if (bestAsk && order.side === OrderSide.BUY && order.entryPrice >= bestAsk) {

                return this.reject(EVENT_REJECT_CODES.POST_ONLY_WOULD_TRADE, "Post only order would execute immediately");
            }

            if (bestBid && order.side === OrderSide.SELL && order.entryPrice <= bestBid) {

                return this.reject(EVENT_REJECT_CODES.POST_ONLY_WOULD_TRADE, "Post only order would execute immediately");
            }
        }

    }

    private validateRiskRules(order: MarketOrderType, market: Market) {
        if (order.type === OrderType.MARKET && !order.liquidation) {

            const liquidity = this.getAvailableLiquidity(order);

            if (liquidity < order.quantity) {
                return this.reject(EVENT_REJECT_CODES.NO_LIQUIDITY, "Insufficient market liquidity");
            }
        }

        const userBalances = this.state.balances.get(order.userId);

        if (!userBalances) {
            return this.reject(EVENT_REJECT_CODES.INSUFFICIENT_BALANCE, "User balances not found");
        }

        if (order.marketType !== MarketType.PERP) {

            if (order.side === OrderSide.BUY) {

                const quoteBalance = userBalances.get(market.quoteAsset.symbol);

                if (!quoteBalance) {
                    return this.reject(EVENT_REJECT_CODES.INSUFFICIENT_BALANCE, "Quote asset balance missing");
                }

                const availableQuote = quoteBalance.total - quoteBalance.locked;

                if (availableQuote < (order.quantity * order.entryPrice)) {
                    return this.reject(EVENT_REJECT_CODES.INSUFFICIENT_BALANCE, "Insufficient base asset balance");
                }
            }

            if (order.side === OrderSide.SELL) {

                const baseBalance = userBalances.get(market.baseAsset.symbol);

                if (!baseBalance) {
                    return this.reject(EVENT_REJECT_CODES.INSUFFICIENT_BALANCE, "Base asset balance missing");
                }

                const availableBase = baseBalance.total - baseBalance.locked;

                if (availableBase < order.quantity) {
                    return this.reject(EVENT_REJECT_CODES.INSUFFICIENT_BALANCE, "Insufficient base asset balance");
                }
            }

            return;
        }

        const collateralAsset = market.quoteAsset.symbol;

        const collateralBalance = userBalances.get(collateralAsset);

        if (!collateralBalance) {
            return this.reject(EVENT_REJECT_CODES.INSUFFICIENT_MARGIN, "Collateral balance missing");
        }
    }

    private getBestAsk(orderbook: OrderbookEngine): number | undefined {

        const node = orderbook.askTree.begin;

        return node.valid ? node.key : undefined;
    }

    private getBestBid(orderbook: OrderbookEngine): number | undefined {

        const node = orderbook.bidTree.end;

        return node.valid ? node.key : undefined;
    }

    private getAvailableLiquidity(order: MarketOrderType): number {

        const orderbook = this.state.orderbooks.get(order.symbol);

        if (!orderbook) { return 0; }

        let liquidity = 0;

        const levels = order.side === OrderSide.BUY
            ? orderbook.asks
            : orderbook.bids;

        levels.forEach((level: OrderList) => {

            if (level.totalQty <= 0) {
                return;
            }

            let current = level.head;

            while (current) {
                if (current.order.userId !== order.userId) {
                    liquidity += remaining(current.order);
                }
                current = current.next;
            }
        }
        );

        return liquidity;
    }

    private isStepAligned(value: number, step: number): boolean {
        if (step <= 0) return false;
        const ratio = value / step;
        return Math.abs(ratio - Math.round(ratio)) < 1e-6;
    }

    private reject(code: EVENT_REJECT_CODES, message: string): never {

        throw new RejectError(code, message);
    }
}