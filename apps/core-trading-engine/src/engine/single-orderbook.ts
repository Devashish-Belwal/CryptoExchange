import { EVENT_REJECT_CODES, FillStatus, InMarketFillType, Market, MarketOrderType, OrderbookSnapshot, OrderSide, OrderStatus, OrderType, STPMode, TimeInForce } from "@workspace/shared";
import { OrderList, OrderNode, remaining } from "../utils/order-list";
import createRBTree from "functional-red-black-tree";
import { BalanceEngine } from "./balance-engine";
import { RejectError } from "../utils/error";

// for matching buy uses ask tree and map & sell uses bid tree and map
//  for storing buy uses bid tree and map & sell uses ask tree and map

export class OrderbookEngine {
    readonly market: Market;

    bids = new Map<number, OrderList>();
    asks = new Map<number, OrderList>();

    bidTree = createRBTree<number, boolean>();
    askTree = createRBTree<number, boolean>();

    orderMap = new Map<string, OrderNode>();

    userOrders = new Map<string, Set<string>>();

    private tradeId = 0;

    lastTradedPrice = 0;
    private autoCancelledOrders: MarketOrderType[] = [];

    private matchedOrders = new Map<string, MarketOrderType>();

    constructor(
        market: Market,
        private readonly balanceEngine: BalanceEngine,
        lastTradeId: number
    ) {
        this.market = market;
        this.tradeId = ++lastTradeId;
    }

    isEmpty(): boolean {
        return this.orderMap.size === 0;
    }

    addOrder(order: MarketOrderType): MarketOrderType {
        this.autoCancelledOrders = [];
        this.matchedOrders = new Map();

        if (order.timeInForce === TimeInForce.FOK) {
            const executable = this.calculateExecutableQty(order);
            if (executable < remaining(order)) {
                order.status = OrderStatus.CANCELLED;
                return order;
            }
        }

        if (order.postOnly && this.wouldCross(order)) {
            order.status = OrderStatus.REJECTED;
            return order;
        }

        return this.match(order);
    }

    private calculateExecutableQty(order: MarketOrderType) {
        let executable = 0;
        let remianingQty = remaining(order);
        const iter = order.side === OrderSide.BUY ? this.askTree.begin : this.bidTree.end;
        while (iter && iter.valid && remianingQty > 0) {
            const price = iter.key;
            if (price === undefined) break;

            if (!this.canPriceCross(order, price)) break;

            const level = order.side === OrderSide.BUY ? this.asks.get(price) : this.bids.get(price);
            if (!level) break;

            let executableAtLevel = 0;
            let current = level.head;
            while (current) {
                if (current.order.userId !== order.userId) {
                    executableAtLevel += remaining(current.order)
                }
                current = current.next;
            }

            const fillable = Math.min(executableAtLevel, remianingQty);
            executable += fillable;
            remianingQty -= fillable;

            if (order.side === OrderSide.BUY) {
                iter.next()
            } else {
                iter.prev()
            }
        }

        return executable;
    }

    private wouldCross(order: MarketOrderType) {
        const bestTree = order.side === OrderSide.BUY ? this.askTree.begin : this.bidTree.end;
        if (!bestTree || !bestTree.valid) return false;
        const bestPrice = bestTree.key;
        if (bestPrice === undefined) return false;
        if (order.side === OrderSide.BUY) return order.entryPrice >= bestPrice;
        return order.entryPrice <= bestPrice;
    }

    private match(taker: MarketOrderType): MarketOrderType {
        const fills: InMarketFillType[] = [];
        let reservationRejected: boolean = false;

        while (remaining(taker) > 0) {
            const bestPrice = this.getBestOppositePrice(taker.side);

            if (bestPrice === undefined) break;

            if (!this.canPriceCross(taker, bestPrice)) break;

            const marketLevels = taker.side === OrderSide.BUY ? this.asks : this.bids;

            const currentLevel = marketLevels.get(bestPrice);

            if (!currentLevel) break;

            let current = currentLevel.head;

            while (current && remaining(taker) > 0) {
                const maker = current.order;
                const next = current.next;

                if (taker.userId === maker.userId) {
                    const isTakerActive = this.handleSTP(taker, maker, current, currentLevel);

                    // The taker is no more active remove it from the loop
                    if (isTakerActive) {
                        current = null;
                        break;
                    }

                    // the maker is not active iterate to next loop cycle
                    current = next;
                    continue;

                }

                const makerRemaining = remaining(maker);

                const requestedQty = Math.min(remaining(taker), makerRemaining);

                const perpared = this.balanceEngine.prepareFill(maker, taker, requestedQty, bestPrice, this.market);
                const tradableQty = perpared.qty;

                if (tradableQty <= 0) {
                    if (perpared.makerLimited) {

                        current = next;
                        continue;
                    }
                    reservationRejected = perpared.reservationRejected;
                    current = null
                    break;
                }

                maker.filledQuantity += tradableQty;
                taker.filledQuantity += tradableQty;
                maker.remainingQuantity = remaining(maker);
                this.tradeId++;
                this.lastTradedPrice = bestPrice;

                const fill: InMarketFillType = {
                    price: bestPrice,
                    qty: tradableQty,
                    tradeId: this.tradeId,
                    takerOrderId: taker.orderId,
                    takerUserId: taker.userId,
                    makerOrderId: maker.orderId,
                    makerUserId: maker.userId,
                    side: maker.side,
                    symbol: maker.symbol,
                    timestamp: Date.now(),
                    status: FillStatus.TRADE,
                    takerFee: 0,
                    makerFee: 0,
                }

                fills.push(fill);
                maker.fills.push(fill);
                this.matchedOrders.set(maker.orderId, maker);
                this.matchedOrders.set(taker.orderId, taker);

                const takerCurrentNotional = taker.averagePrice * (taker.filledQuantity - tradableQty) + bestPrice * tradableQty;
                const makerCurrentNotional = maker.averagePrice * (maker.filledQuantity - tradableQty) + bestPrice * tradableQty;

                taker.averagePrice = taker.filledQuantity === 0 ? 0 : takerCurrentNotional / taker.filledQuantity;
                maker.averagePrice = maker.filledQuantity === 0 ? 0 : makerCurrentNotional / maker.filledQuantity;

                currentLevel.decreaseQty(tradableQty);

                if (remaining(maker) === 0) {
                    maker.status = OrderStatus.FILLED;
                    currentLevel.remove(current);
                    this.orderMap.delete(maker.orderId);
                    this.removeUserOrder(maker.orderId, maker.userId);
                } else {
                    maker.status = OrderStatus.PARTIAL_FILLED;
                }

                this.recordDepthChange(taker, maker.side, bestPrice, currentLevel.totalQty);


                if (perpared.reservationRejected) {
                    if (perpared.makerLimited) {
                        current = next;
                        continue;
                    }
                    reservationRejected = perpared.reservationRejected;
                    current = null;
                    break;
                }

                current = next;
            }

            if (taker.status === OrderStatus.CANCELLED || reservationRejected) {
                break;
            }

            if (currentLevel.size === 0) {
                this.recordDepthChange(
                    taker,
                    taker.side === OrderSide.BUY ? OrderSide.SELL : OrderSide.BUY,
                    bestPrice,
                    0
                );

                marketLevels.delete(bestPrice);

                if (taker.side === OrderSide.BUY) {
                    this.askTree = this.askTree.remove(bestPrice);
                } else {
                    this.bidTree = this.bidTree.remove(bestPrice)
                }
            }
        }

        if (reservationRejected) {
            taker.status = taker.filledQuantity > 0 ? OrderStatus.PARTIAL_REJECTED : OrderStatus.REJECTED;
        } else if (taker.status === OrderStatus.CANCELLED) {
            taker.remainingQuantity = remaining(taker);
        } else if (remaining(taker) > 0) {
            if (
                taker.type === OrderType.MARKET ||
                taker.timeInForce === TimeInForce.IOC ||
                taker.timeInForce === TimeInForce.FOK
            ) {
                taker.status = taker.filledQuantity > 0 ? OrderStatus.PARTIAL_FILLED : OrderStatus.CANCELLED;
            } else {
                this.restOrder(taker);
                taker.status = taker.filledQuantity > 0 ? OrderStatus.PARTIAL_FILLED : OrderStatus.OPEN
            }
        } else {
            taker.status = OrderStatus.FILLED;
        }

        taker.fills = fills;
        taker.remainingQuantity = remaining(taker);

        return taker;
    }

    private handleSTP(taker: MarketOrderType, maker: MarketOrderType, makerNode: OrderNode, list: OrderList) {
        const stpMode = taker.stpMode || STPMode.CANCEL_TAKER;

        switch (stpMode) {
            case STPMode.CANCEL_TAKER:
                taker.status = OrderStatus.CANCELLED;
                return true;
            case STPMode.CANCEL_MAKER:
                maker.status = OrderStatus.CANCELLED;
                this.autoCancelledOrders.push(maker);
                list.remove(makerNode);
                this.recordDepthChange(taker, maker.side, maker.entryPrice, list.totalQty);
                this.orderMap.delete(maker.orderId);
                this.removeUserOrder(maker.orderId, maker.userId);
                return false;
            case STPMode.CANCEL_BOTH:
                taker.status = OrderStatus.CANCELLED;
                maker.status = OrderStatus.CANCELLED;
                this.autoCancelledOrders.push(maker);
                list.remove(makerNode);
                this.recordDepthChange(taker, maker.side, maker.entryPrice, list.totalQty);
                this.orderMap.delete(maker.orderId);
                this.removeUserOrder(maker.orderId, maker.userId);
                return true;
        }
    }

    private restOrder(order: MarketOrderType, shouldTrackDepth = true) {
        const marketLevels = order.side === OrderSide.BUY ? this.bids : this.asks;
        let marketTree = order.side === OrderSide.BUY ? this.bidTree : this.askTree;

        let currentLevel = marketLevels.get(order.entryPrice);

        if (!currentLevel) {
            currentLevel = new OrderList();

            marketLevels.set(order.entryPrice, currentLevel);
            marketTree = marketTree.insert(order.entryPrice, true);

            if (order.side === OrderSide.BUY) {
                this.bidTree = marketTree;
            } else {
                this.askTree = marketTree;
            }
        }

        const node = currentLevel.append(order);

        if (shouldTrackDepth) {
            this.recordDepthChange(order, order.side, order.entryPrice, currentLevel.totalQty);
        }

        this.orderMap.set(order.orderId, node);
        this.addUserOrder(order.orderId, order.userId);
    }

    private recordDepthChange(order: MarketOrderType, side: OrderSide, price: number, quantity: number) {

        const depths = side === OrderSide.BUY ? order.depth.bids : order.depth.asks;
        const existing = depths.find((depth) => depth.price === price);

        if (existing) {
            existing.quantity = quantity;
            return;
        }

        depths.push({ price, quantity })
    }

    private addUserOrder(orderId: string, userId: string) {
        let orders = this.userOrders.get(userId);

        if (!orders) {
            orders = new Set();

            this.userOrders.set(userId, orders);
        }

        orders.add(orderId);
    }

    private removeUserOrder(orderId: string, userId: string) {
        const orders = this.userOrders.get(userId);

        if (!orders) { return; }

        orders.delete(orderId);

        if (orders.size === 0) {
            this.userOrders.delete(userId);
        }
    }

    private getBestOppositePrice(side: OrderSide): number | undefined {
        if (side === OrderSide.BUY) {
            const best = this.askTree.begin;
            return best.valid ? best.key : undefined;
        }

        const best = this.bidTree.end;
        return best.valid ? best.key : undefined;
    }

    private canPriceCross(order: MarketOrderType, bestPrice: number) {
        if (order.type === OrderType.MARKET) {
            return true;
        }

        if (order.side === OrderSide.BUY) {
            return order.entryPrice >= bestPrice;
        }

        return order.entryPrice <= bestPrice;
    }

    consumeCancelledOrders() {
        const cancelledOrders = this.autoCancelledOrders;
        this.autoCancelledOrders = [];
        return cancelledOrders;
    }

    consumeMatchedOrders() {
        const matchedOrders = this.matchedOrders;
        this.matchedOrders = new Map();
        return matchedOrders;
    }

    // ------------------------

    removeOrder(orderId: string, userId: string): MarketOrderType {
        const orderNode = this.orderMap.get(orderId);

        if (!orderNode) {
            return this.reject(EVENT_REJECT_CODES.ORDER_DONT_EXISTS, "order not found in orderbook")
        }

        const order = orderNode.order;

        if (order.userId !== userId) {
            return this.reject(EVENT_REJECT_CODES.UNAUTHORIZED, "Unauthorized deletion request");
        }

        const marketLevels = order.side === OrderSide.BUY ? this.bids : this.asks;
        const currentLevel = marketLevels.get(order.entryPrice);

        if (!currentLevel) {
            return this.reject(EVENT_REJECT_CODES.INVALID_MARKET, "order not found in orderbook");
        }

        currentLevel.remove(orderNode);

        this.recordDepthChange(order, order.side, order.entryPrice, currentLevel.totalQty);

        this.orderMap.delete(orderId);

        this.removeUserOrder(orderId, userId);
        order.status = OrderStatus.CANCELLED;

        if (currentLevel.size === 0) {
            marketLevels.delete(order.entryPrice);

            if (order.side === OrderSide.BUY) {
                this.bidTree = this.bidTree.remove(order.entryPrice);
            } else {
                this.askTree = this.askTree.remove(order.entryPrice);
            }
        }

        return order;

    }

    private reject(code: EVENT_REJECT_CODES, message: string): never {
        throw new RejectError(code, message);
    }

    // ------------------------

    getDepth(limit?: number) {

        const bids: [string, string][] = [];
        const asks: [string, string][] = [];

        // Highest bid -> Lowest bid
        const bidIter = this.bidTree.end;
        while (bidIter.valid) {
            const price = bidIter.key;
            if (!price) continue;
            const level = this.bids.get(price);

            if (level && level.totalQty > 0) {
                bids.push([
                    price.toString(),
                    level.totalQty.toString(),
                ]);

                if (limit && bids.length >= limit) {
                    break;
                }
            }

            bidIter.prev();
        }

        // Lowest ask -> Highest ask
        const askIter = this.askTree.begin;
        while (askIter.valid) {
            const price = askIter.key;
            if (!price) continue;
            const level = this.asks.get(price);

            if (level && level.totalQty > 0) {
                asks.push([
                    price.toString(),
                    level.totalQty.toString(),
                ]);

                if (limit && asks.length >= limit) {
                    break;
                }
            }

            askIter.next();
        }

        return { bids, asks };

    }

    getOpenInterest() {
        const orderVolume = this.orderMap.size;
        let totalQuantity = 0;

        for (const node of this.orderMap.values()) {
            const order = node.order;
            totalQuantity += remaining(order);
        }

        return {
            volume: orderVolume,
            quantity: totalQuantity,
            lastPrice: this.lastTradedPrice
        }
    }

    createSnapshot(): OrderbookSnapshot {
        return {
            symbol: this.market.symbol,
            lastTradedPrice: this.lastTradedPrice,
            tradeId: this.tradeId,
            orders: Array.from(this.orderMap.values()).map((node) => structuredClone(node.order)),
        };
    }

    restoreSnapshot(snapshot: OrderbookSnapshot) {
        this.bids = new Map();
        this.asks = new Map();
        this.bidTree = createRBTree<number, boolean>();
        this.askTree = createRBTree<number, boolean>();
        this.orderMap = new Map();
        this.userOrders = new Map();

        this.lastTradedPrice = snapshot.lastTradedPrice;
        this.tradeId = snapshot.tradeId;

        for (const order of snapshot.orders) {
            this.restOrder(structuredClone(order), false);
        }
    }

}