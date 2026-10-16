import { AssetUpdate, BalanceChangeSide, BalanceChangeType, BalanceUpdateTransactionType, BalanceUpdateType, BaseUpdate, ClosedPositionUpdate, CommissionUpdate, FillType, Market, MarketOrderType, MarketType, MarketUpdate, MarkPriceUpdate, TickerUpdate, UserPositionType, UserUpdate } from "@workspace/shared";
import { orderParseToReturn, parseOrderFills } from "../utils/parser";
import { EngineState } from "./engine-state";

export class UpdateManagerEngine {
    private asset?: AssetUpdate;
    private market?: MarketUpdate;
    private user?: UserUpdate;

    private balanceUpdates: Map<string, BalanceUpdateType>;
    private orders: Map<string, ReturnType<typeof orderParseToReturn>>;
    private trades: Map<number, FillType>;

    private positions: Map<string, UserPositionType>;
    private closedPositions: ClosedPositionUpdate[];
    private commissions: Map<string, CommissionUpdate>;

    // UPDATES FOR WS TO FRONTEND
    private depthLevels: Map<string, { bids: Map<string, string>; asks: Map<string, string> }>;
    private tickers: Map<string, TickerUpdate>;
    private markPrices: Map<string, MarkPriceUpdate>;


    constructor(private readonly state: EngineState) {
        this.balanceUpdates = new Map();
        this.orders = new Map();
        this.trades = new Map();
        this.depthLevels = new Map();
        this.tickers = new Map();
        this.markPrices = new Map();
        this.positions = new Map();
        this.closedPositions = [];
        this.commissions = new Map();
    }

    captureAsset(asset: AssetUpdate) {
        this.asset = asset;
    }

    captureMarket(market: MarketUpdate) {
        this.market = market;
    }

    captureUser(user: UserUpdate) {
        this.user = user;
    }

    capturePosition(position: UserPositionType) {
        this.positions.set(position.positionId, { ...position });
    }

    captureClosedPosition(update: ClosedPositionUpdate) {
        this.closedPositions.push(update);
    }

    captureCommission(symbol: string, commissionFund: number, insuranceFund: number) {
        this.commissions.set(symbol, { symbol, commissionFund, insuranceFund });
    }

    captureBalanceUpdate(
        userId: string,
        symbol: string,
        amount: number,
        side: BalanceChangeSide,
        type: BalanceChangeType,
        orderId?: string,
        marketSymbol?: string,
        tradeId?: string,
    ) {
        const userBalances = this.state.balances.get(userId);
        if (!userBalances) return;

        const currentBalance = userBalances.get(symbol);
        if (!currentBalance) return;

        const trans: BalanceUpdateTransactionType = {
            userId, symbol, side, type,
            marketSymbol, orderId, tradeId,
            amount: String(amount),
            timestamp: Date.now()
        }

        const key = `${userId}:${symbol}`;
        const previousRecord = this.balanceUpdates.get(key);

        if (!previousRecord) {
            this.balanceUpdates.set(key, {
                userId, symbol,
                total: currentBalance.total,
                locked: currentBalance.locked,
                transactions: [trans]
            })
            return;
        }

        previousRecord.transactions.push(trans)

        this.balanceUpdates.set(key, {
            userId, symbol,
            total: currentBalance.total,
            locked: currentBalance.locked,
            transactions: [...previousRecord.transactions]
        })
    }

    discardBalanceUpdates() {
        this.balanceUpdates.clear();
    }

    captureOrder(order: MarketOrderType, market: Market) {
        this.captureOrders([order], order, market);
    }

    captureOrders(orders: Iterable<MarketOrderType>, currentOrder: MarketOrderType, market: Market) {
        const updatedOrders = Array.from(orders);

        for (const updatedOrder of updatedOrders) {
            this.orders.set(updatedOrder.orderId, orderParseToReturn(updatedOrder));

            for (const fill of parseOrderFills(updatedOrder.fills)) {
                this.trades.set(fill.tradeId, fill);
            }
        }

        this.mergeDepthLevels(updatedOrders, currentOrder);

        const trades = this.getOrderTrades(updatedOrders);

        const ticker = this.updateDailyTicker(currentOrder.symbol, trades);
        if (ticker) {
            this.tickers.set(ticker.symbol, ticker);
        }

        const markPrice = this.buildMarkPriceUpdate(currentOrder, trades, market);
        if (markPrice) {
            this.markPrices.set(markPrice.symbol, markPrice);
        }
    }

    consume(): BaseUpdate | undefined {
        const update: BaseUpdate = {};

        if (this.asset) update.asset = this.asset;
        if (this.market) update.market = this.market;
        if (this.user) update.user = this.user;

        if (this.orders.size) update.orders = Array.from(this.orders.values());

        if (this.trades.size) {
            update.trades = Array.from(this.trades.values()).sort((a, b) => a.tradeId - b.tradeId);
        }

        if (this.depthLevels.size) {
            update.depths = Array.from(this.depthLevels.entries()).map(([symbol, levels]) => ({
                symbol,
                bids: Array.from(levels.bids.entries()),
                asks: Array.from(levels.asks.entries()),
            }));
        }

        if (this.tickers.size) update.tickers = Array.from(this.tickers.values());
        if (this.markPrices.size) update.markPrices = Array.from(this.markPrices.values());
        if (this.balanceUpdates.size) update.balances = Array.from(this.balanceUpdates.values());
        if (this.positions.size) update.positions = Array.from(this.positions.values());
        if (this.closedPositions.length) update.closedPositions = [...this.closedPositions];
        if (this.commissions.size) update.commissions = Array.from(this.commissions.values());

        this.reset();

        return Object.keys(update).length > 0 ? update : undefined;
    }

    reset() {
        this.asset = undefined;
        this.market = undefined;
        this.user = undefined;
        this.balanceUpdates.clear();
        this.orders.clear();
        this.trades.clear();
        this.depthLevels.clear();
        this.tickers.clear();
        this.markPrices.clear();
        this.positions.clear();
        this.closedPositions = [];
        this.state.fundingPayments.length = 0;
        this.commissions.clear();
    }

    private mergeDepthLevels(orders: MarketOrderType[], currentOrder: MarketOrderType) {
        let levels = this.depthLevels.get(currentOrder.symbol);

        if (!levels) {
            levels = { bids: new Map(), asks: new Map() };
            this.depthLevels.set(currentOrder.symbol, levels);
        }

        for (const order of orders) {
            for (const depth of order.depth.bids) {
                levels.bids.set(String(depth.price), String(depth.quantity));
            }

            for (const depth of order.depth.asks) {
                levels.asks.set(String(depth.price), String(depth.quantity));
            }
        }
    }

    private getOrderTrades(orders: MarketOrderType[]): FillType[] {
        const fillsByTradeId = new Map<number, FillType>();

        for (const order of orders) {
            for (const fill of parseOrderFills(order.fills)) {
                fillsByTradeId.set(fill.tradeId, fill);
            }
        }

        return Array.from(fillsByTradeId.values()).sort((a, b) => a.tradeId - b.tradeId);
    }

    private updateDailyTicker(symbol: string, trades: FillType[]): TickerUpdate | null {
        if (trades.length === 0) {
            return null;
        }

        const prices = trades.map((trade) => Number(trade.price));
        const quantities = trades.map((trade) => Number(trade.qty));
        const batchHigh = Math.max(...prices);
        const batchLow = Math.min(...prices);
        const batchVolume = quantities.reduce((total, quantity) => total + quantity, 0);
        const lastTrade = trades[trades.length - 1]!;
        const lastPrice = Number(lastTrade.price);
        const periodStart = getUTCDayStart(lastTrade.timestamp);

        const existing = this.state.dailyTickers.get(symbol);
        const isNewPeriod = !existing || existing.periodStart < periodStart;

        const openPrice = isNewPeriod ? prices[0]! : Number(existing.openPrice);
        const high = isNewPeriod ? batchHigh : Math.max(Number(existing.high), batchHigh);
        const low = isNewPeriod ? batchLow : Math.min(Number(existing.low), batchLow);
        const volume = (isNewPeriod ? 0 : Number(existing.volume)) + batchVolume;
        const tradeCount = (isNewPeriod ? 0 : existing.trades) + trades.length;
        const priceChange = lastPrice - openPrice;
        const priceChangePercentage = openPrice === 0 ? 0 : (priceChange / openPrice) * 100;

        const ticker: TickerUpdate = {
            symbol,
            openPrice: String(openPrice),
            high: String(high),
            low: String(low),
            lastPrice: String(lastPrice),
            priceChange: String(priceChange),
            priceChangePercentage: String(priceChangePercentage),
            volume: String(volume),
            trades: tradeCount,
            periodStart,
            timestamp: lastTrade.timestamp,
        };

        this.state.dailyTickers.set(symbol, ticker);

        return ticker;
    }

    private buildMarkPriceUpdate(currentOrder: MarketOrderType, trades: FillType[], market: Market): MarkPriceUpdate | null {
        if (market.marketType !== MarketType.PERP || trades.length === 0) {
            return null;
        }

        const latestTrade = trades[trades.length - 1];

        if (!latestTrade) {
            return null;
        }

        return {
            symbol: currentOrder.symbol,
            markPrice: latestTrade.price,
            timestamp: latestTrade.timestamp,
        };
    }
}

function getUTCDayStart(timestampMs: number): number {
    const date = new Date(timestampMs);
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}
