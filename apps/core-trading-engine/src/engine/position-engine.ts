import { EVENT_REJECT_CODES, FundingUpdateEventPayload, GetAllUserOpenPositionRequestPayload, GetUserOpenPositionRequestPayload, IndexPriceUpdateEventPayload, InMarketFillType, Market, MarketOrderType, MarketType, OrderPosition, OrderSide, OrderStatus, OrderType, PerpMarketOrderType, STPMode, TimeInForce, UserPositionType } from "@workspace/shared";
import { EngineState } from "./engine-state";
import { RejectError } from "../utils/error";
import { PositionEngine } from "./single-position";
import { BalanceEngine } from "./balance-engine";
import { UpdateManagerEngine } from "./update-manager-engine";
import { FundManagementEngine } from "./fund-management-engine";

export class PositionMatchingEngine {
    constructor(
        private readonly state: EngineState,
        private readonly balanceEngine: BalanceEngine,
        private readonly updateManagerEngine: UpdateManagerEngine,
        private readonly fundManagementEngine: FundManagementEngine,
    ) { }

    initializeMarket(market: Market) {
        if (!this.state.positions.has(market.symbol)) {
            this.state.positions.set(market.symbol, new PositionEngine(market, this.state, this.balanceEngine, this.updateManagerEngine, this.fundManagementEngine));
        }
    }

    getuserPosition(payload: GetUserOpenPositionRequestPayload): UserPositionType {
        const positions = this.state.positions.get(payload.symbol);

        if (!positions) {
            this.reject(EVENT_REJECT_CODES.INVALID_MARKET, "Market positions not found");
        }

        const positionId = positions.positionByUserId.get(payload.userId);

        if (!positionId) {
            this.reject(EVENT_REJECT_CODES.POSITION_NOT_FOUND, "Can not find any position for the user");
        }

        const position = positions.positionById.get(positionId);

        if (!position) {
            this.reject(EVENT_REJECT_CODES.POSITION_NOT_FOUND, "Can not find any position for the user");
        }

        return position;
    }

    // Unlike getuserPosition, there is nothing to reject on here - having no open positions
    // at all is a normal, non-error state for this query, so this always returns an array
    // (possibly empty) instead of throwing POSITION_NOT_FOUND.
    getAllUserPositions(payload: GetAllUserOpenPositionRequestPayload): UserPositionType[] {
        const positions: UserPositionType[] = [];

        for (const marketPositions of this.state.positions.values()) {
            const positionId = marketPositions.positionByUserId.get(payload.userId);

            if (!positionId) continue;

            const position = marketPositions.positionById.get(positionId);

            if (position) positions.push(position);
        }

        return positions;
    }

    applyFills(fill: InMarketFillType, taker: MarketOrderType, maker: MarketOrderType) {
        if (maker.marketType !== MarketType.PERP || taker.marketType !== MarketType.PERP) {
            return;
        }

        const makerOrder: PerpMarketOrderType = {
            ...maker,
            position: maker.side === OrderSide.BUY ? OrderPosition.LONG : OrderPosition.SHORT,
            liquidation: maker.liquidation!,
            leverage: maker.leverage!,
            margin: maker.margin!,
            reduceOnly: maker.reduceOnly!
        }

        const takerOrder: PerpMarketOrderType = {
            ...taker,
            position: taker.side === OrderSide.BUY ? OrderPosition.LONG : OrderPosition.SHORT,
            liquidation: taker.liquidation!,
            leverage: taker.leverage!,
            margin: taker.margin!,
            reduceOnly: taker.reduceOnly!
        }

        const positions = this.getMarketPositions(fill.symbol);
        positions.applyOrderFill(makerOrder, fill.makerUserId, fill.qty, fill.price, fill.tradeId);
        positions.applyOrderFill(takerOrder, fill.takerUserId, fill.qty, fill.price, fill.tradeId);
    }

    getLiquidPositions(payload: IndexPriceUpdateEventPayload): UserPositionType[] {
        const positions = this.state.positions.get(payload.symbol);

        if (!positions) {
            this.reject(EVENT_REJECT_CODES.INVALID_MARKET, "Market positions not found");
        }

        const indexPrice = Number(payload.indexPrice);
        const lquidablePositions = positions.getLiquidatablePositions(indexPrice);

        const oldMarketRisk = this.state.marketRisk.get(payload.symbol);

        if (oldMarketRisk) {
            this.state.marketRisk.set(payload.symbol, {
                ...oldMarketRisk,
                indexPrice,
                indexUpdatedAt: payload.timestamp,
            })
        } else {
            this.state.marketRisk.set(payload.symbol, {
                markPrice: undefined,
                markUpdatedAt: 0,
                indexPrice,
                indexUpdatedAt: payload.timestamp,
                lastFundingRateBps: 0,
                lastFundingSettledAt: 0
            })
        }

        return lquidablePositions;
    }

    onFundingSettlement(payload: FundingUpdateEventPayload) {
        const market = this.state.markets.get(payload.symbol);
        if (!market) {
            throw new RejectError(EVENT_REJECT_CODES.MARKET_NOT_FOUND, "Market does not exists");
        }
        const marketRisk = this.state.marketRisk.get(market.symbol);
        if (!marketRisk) {
            throw new RejectError(EVENT_REJECT_CODES.MARKET_NOT_FOUND, "Market risk does not exists");
        }

        const positions = this.state.positions.get(payload.symbol);

        if (!positions) {
            this.reject(EVENT_REJECT_CODES.INVALID_MARKET, "Market positions not found");
        }

        if (!Number.isInteger(payload.intervalSeconds) || payload.intervalSeconds <= 0) {
            this.reject(EVENT_REJECT_CODES.INVALID_AMOUNT, "Invalid funding interval");
        }


        const markPrice = marketRisk.markPrice;
        const indexPrice = marketRisk.indexPrice;

        if (indexPrice === undefined || indexPrice <= 0) {
            this.reject(EVENT_REJECT_CODES.INVALID_MARKET, "Cannot settle funding: invalid index price");
        }

        if (markPrice === undefined || markPrice <= 0) {
            this.reject(EVENT_REJECT_CODES.INVALID_MARKET, "Cannot settle funding: invalid mark price");
        }

        const premiumBps = ((indexPrice - markPrice) * 10_000) / indexPrice;

        if (!Number.isFinite(premiumBps)) {
            this.reject(EVENT_REJECT_CODES.INTERNAL_ERROR, "Invalid funding premium");
        }
        const fundingRateBps = Math.max(-1, Math.min(premiumBps, 1));
        const result = positions.applyFunding(fundingRateBps);

        marketRisk.lastFundingRateBps = fundingRateBps;
        marketRisk.lastFundingSettledAt = Date.now();

        const lquidablePositions = positions.getLiquidatablePositions(indexPrice);

        return {
            symbol: market.symbol,
            indexPrice,
            ...result,
            liquidatablePositions: lquidablePositions
        }
    }

    triggerADL(symbol: string, liquidatedUserId: string, liquidatedSide: OrderPosition, qty: number, price: number, tradeId: number): number {
        const positions = this.getMarketPositions(symbol);
        const oppositeSide = liquidatedSide === OrderPosition.LONG ? OrderPosition.SHORT : OrderPosition.LONG;

        const liquidatedPosition = positions.getPosition(liquidatedUserId);
        const liquidatedLeverage = liquidatedPosition?.leverage ?? 1;

        let remaining = qty;
        let fillIndex = 0;

        for (const candidate of positions.getADLCandidates(oppositeSide, price)) {
            if (remaining <= 0) break;
            if (candidate.userId === liquidatedUserId) continue;

            const fillQty = Math.min(remaining, candidate.quantity);

            const liquidatedOrder = this.buildADLOrder(symbol, liquidatedUserId, liquidatedLeverage, oppositeSide, true, tradeId, fillIndex);
            const counterOrder = this.buildADLOrder(symbol, candidate.userId, candidate.leverage, liquidatedSide, false, tradeId, fillIndex);

            positions.applyOrderFill(liquidatedOrder, liquidatedUserId, fillQty, price, tradeId);
            positions.applyOrderFill(counterOrder, candidate.userId, fillQty, price, tradeId);

            remaining -= fillQty;
            fillIndex++;
        }

        if (remaining > 0) {
            console.error(`ADL could not fully close ${symbol} position for user ${liquidatedUserId}: no opposite-side positions left, ${remaining} still open`);
        }

        return remaining;
    }

    private buildADLOrder(
        symbol: string,
        userId: string,
        leverage: number,
        position: OrderPosition,
        liquidation: boolean,
        tradeId: number,
        fillIndex: number,
    ): PerpMarketOrderType {
        return {
            symbol,
            userId,
            entryPrice: 0,
            quantity: 0,
            position,
            type: OrderType.MARKET,
            postOnly: false,
            stpMode: STPMode.CANCEL_TAKER,
            marketType: MarketType.PERP,
            timeInForce: TimeInForce.IOC,
            createdAt: Date.now(),
            orderId: `ADL-${tradeId}-${fillIndex}-${liquidation ? "L" : "C"}`,
            remainingQuantity: 0,
            filledQuantity: 0,
            averagePrice: 0,
            balance: { allotted: 0, used: 0, released: 0 },
            status: OrderStatus.FILLED,
            liquidation,
            leverage: Math.max(1, leverage),
            margin: 0,
            reduceOnly: true,
            adl: true,
            depth: { bids: [], asks: [] },
            fills: [],
        };
    }

    private getMarketPositions(symbol: string) {
        const positions = this.state.positions.get(symbol);

        if (!positions) {
            this.reject(EVENT_REJECT_CODES.INVALID_MARKET, "Market positions not found");
        }

        return positions;
    }

    private reject(code: EVENT_REJECT_CODES, message: string): never {
        throw new RejectError(code, message);
    }
}