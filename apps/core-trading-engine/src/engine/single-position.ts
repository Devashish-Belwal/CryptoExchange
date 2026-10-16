import { EVENT_REJECT_CODES, Market, OrderPosition, PerpMarketOrderType, PositionSnapshot, UserPositionType } from "@workspace/shared";
import { EngineState } from "./engine-state";
import createRBTree from "functional-red-black-tree";
import { v4 as uuidv4 } from "uuid";
import { RejectError } from "../utils/error";
import { BalanceEngine } from "./balance-engine";
import { UpdateManagerEngine } from "./update-manager-engine";
import { FundManagementEngine } from "./fund-management-engine";

export class PositionEngine {
    market: Market;
    positionByUserId = new Map<string, string>();
    positionById = new Map<string, UserPositionType>();

    longPositionBucket = new Map<number, Set<string>>();
    shortPositionBucket = new Map<number, Set<string>>();

    longPositionTree = createRBTree<number, boolean>();
    shortPositionTree = createRBTree<number, boolean>();

    constructor(
        market: Market,
        private readonly state: EngineState,
        private readonly balanceEngine: BalanceEngine,
        private readonly updateManagerEngine: UpdateManagerEngine,
        private readonly fundManagementEngine: FundManagementEngine,
    ) {
        this.market = market;
    }

    applyOrderFill(order: PerpMarketOrderType, userId: string, qty: number, price: number, tradeId: number) {
        const position = order.position;
        const currentPositionId = this.positionByUserId.get(order.userId);

        const fillMargin = Math.ceil((price * qty) / order.leverage);
        const reservedFillMargin = order.reduceOnly ? 0 : fillMargin;

        if (!currentPositionId) {
            const createdPosition = this.createPosition(order.userId, order, position, qty, price, fillMargin);
            this.setPosition(createdPosition);
            return;
        }

        const currentPosition = this.positionById.get(currentPositionId);
        if (!currentPosition) {
            return this.reject(EVENT_REJECT_CODES.INTERNAL_ERROR, "Position not found in the market");
        }

        this.removeLiquidationPrice(currentPosition);

        // SAME SIDE POSITION - ADD
        if (currentPosition.position === position) {
            const nextQty = currentPosition.quantity + qty;
            currentPosition.averagePrice = ((currentPosition.averagePrice * currentPosition.quantity) + (price * qty)) / nextQty;
            currentPosition.entryPrice = currentPosition.averagePrice;
            currentPosition.quantity = nextQty;
            currentPosition.margin += fillMargin;
            this.updateDerivedFields(currentPosition);
            this.addLiquidationIndex(currentPosition);
            this.updateManagerEngine.capturePosition(currentPosition);
            return;
        }

        // DIFFRENT SIDE POSITION
        const closingQty = qty < currentPosition.quantity ? qty : currentPosition.quantity;
        const releasedMargin = currentPosition.quantity === 0 ? 0 : (currentPosition.margin * closingQty) / currentPosition.quantity;
        const calculatedPnl = (price - currentPosition.averagePrice) * closingQty;
        const pnl = currentPosition.position === OrderPosition.LONG ? calculatedPnl : -calculatedPnl;

        const deficit = order.liquidation ? Math.max(0, -(releasedMargin + pnl)) : 0;

        // CHECK IF THE NEW QUANTITY IS GREATER OR LESSER THAN EXISTING QUANTITY

        // the release order margin is the margin locked by the existing position and the reserved fill margin is the margin locked by this comming fill if the fill reduces the position then the position margin should release as well as the fill which is reducing it margin also reduces
        if (qty < currentPosition.quantity) {
            this.balanceEngine.releasePerpCollateral(userId, releasedMargin + reservedFillMargin, pnl, this.market, order.orderId, tradeId, deficit);
            currentPosition.quantity -= qty;
            currentPosition.margin -= releasedMargin;
            this.updateDerivedFields(currentPosition);
            this.addLiquidationIndex(currentPosition);
            this.updateManagerEngine.capturePosition(currentPosition);
            return;
        }

        // IF LESS THAN REDUCE THE POSITION SIZE
        this.deletePosition(currentPosition);

        if (qty === currentPosition.quantity) {
            const covered = this.balanceEngine.releasePerpCollateral(userId, releasedMargin + reservedFillMargin, pnl, this.market, order.orderId, tradeId, deficit);
            this.updateManagerEngine.capturePosition(currentPosition);
            this.emitClosedPosition(currentPosition, order, price, pnl, deficit, covered);
            return;
        }

        // IF GREATER THAN DELETE THE EXISTING POSITION AND CREATE A OPPOSITE POSITION
        const flippedQty = qty - currentPosition.quantity;
        const flippedMargin = Math.ceil((flippedQty * price) / order.leverage);
        const reservationTorelease = reservedFillMargin - flippedMargin;

        const covered = this.balanceEngine.releasePerpCollateral(userId, releasedMargin + reservationTorelease, pnl, this.market, order.orderId, tradeId, deficit);
        this.emitClosedPosition(currentPosition, order, price, pnl, deficit, covered);

        const newPosition = this.createPosition(userId, order, position, flippedQty, price, flippedMargin);
        this.setPosition(newPosition);
    }

    private emitClosedPosition(
        position: UserPositionType,
        order: PerpMarketOrderType,
        exitPrice: number,
        realizedPnl: number,
        deficit: number,
        insuranceCovered: number,
    ) {
        const markPrice = this.state.marketRisk.get(this.market.symbol)?.markPrice ?? exitPrice;

        this.updateManagerEngine.captureClosedPosition({
            positionId: position.positionId,
            userId: position.userId,
            symbol: position.symbol,
            side: position.position,
            leverage: position.leverage,
            entryPrice: position.averagePrice,
            exitPrice,
            quantity: position.quantity,
            margin: position.margin,
            realizedPnl,
            closeReason: order.liquidation ? "LIQUIDATED" : order.adl ? "ADL" : "CLOSED",
            openedAt: position.openAt,
            closedAt: Date.now(),
            bankruptcyPrice: order.liquidation ? position.bankruptcyPrice : 0,
            liquidationPrice: order.liquidation ? position.liquidationPrice : 0,
            markPrice: order.liquidation ? markPrice : 0,
            deficit,
            insuranceCovered,
        });
    }

    private createPosition(
        userId: string,
        order: PerpMarketOrderType,
        position: OrderPosition,
        quantity: number,
        price: number,
        margin: number
    ): UserPositionType {
        const created: UserPositionType = {
            userId,
            positionId: uuidv4(),
            orderId: order.orderId,
            symbol: order.symbol,
            position,
            leverage: order.leverage,
            margin,
            averagePrice: price,
            quantity,
            liquidationPrice: 0,
            bankruptcyPrice: 0,
            entryPrice: 0,
            upnl: 0,
            openAt: Date.now()
        }
        this.updateDerivedFields(created);
        return created;
    }

    private deletePosition(position: UserPositionType) {
        this.positionByUserId.delete(position.userId);
        this.positionById.delete(position.positionId);
    }

    private setPosition(position: UserPositionType) {
        this.positionByUserId.set(position.userId, position.positionId);
        this.positionById.set(position.positionId, position);
        this.addLiquidationIndex(position);
        this.updateManagerEngine.capturePosition(position);
    }

    private updateDerivedFields(position: UserPositionType) {
        position.leverage = this.effectiveLeverage(position.quantity, position.averagePrice, position.margin);
        position.bankruptcyPrice = this.bankruptcyPrice(
            position.averagePrice,
            position.quantity,
            position.margin,
            position.position
        );
        position.liquidationPrice = this.liquidationPrice(
            position.averagePrice,
            position.quantity,
            position.margin,
            position.position
        );
    }

    private effectiveLeverage(qty: number, price: number, margin: number) {
        if (margin === 0) return 0;
        return Math.ceil((price * qty) / margin);
    }

    private bankruptcyPrice(price: number, qty: number, margin: number, position: OrderPosition) {
        const move = qty === 0 ? 0 : Math.ceil(margin / qty);
        return this.applyLossMove(price, move, position);
    }

    private liquidationPrice(price: number, qty: number, margin: number, position: OrderPosition) {
        const bankruptcyMove = qty === 0 ? 0 : Math.ceil(margin / qty);
        const liquidationMove = bankruptcyMove * 0.9;
        return this.applyLossMove(price, liquidationMove, position);
    }

    private applyLossMove(price: number, move: number, position: OrderPosition): number {
        if (position === OrderPosition.LONG) {
            return Math.max(price - move, 0);
        }

        return price + move;
    }

    // ----------------------

    private addLiquidationIndex(position: UserPositionType) {
        const marketBucket = position.position === OrderPosition.LONG
            ? this.longPositionBucket : this.shortPositionBucket;

        let bucket = marketBucket.get(position.liquidationPrice);

        if (!bucket) {
            bucket = new Set();
            marketBucket.set(position.liquidationPrice, bucket);

            if (position.position === OrderPosition.LONG) {
                this.longPositionTree = this.longPositionTree.insert(position.liquidationPrice, true);
            } else {
                this.shortPositionTree = this.shortPositionTree.insert(position.liquidationPrice, true);
            }
        }

        bucket.add(position.positionId);
    }

    private removeLiquidationPrice(position: UserPositionType) {
        const marketBucket = position.position === OrderPosition.LONG
            ? this.longPositionBucket : this.shortPositionBucket;

        const bucket = marketBucket.get(position.liquidationPrice);

        if (!bucket) {
            return;
        }

        bucket.delete(position.positionId);

        if (bucket.size > 0) {
            return;
        }

        marketBucket.delete(position.liquidationPrice);
        if (position.position === OrderPosition.LONG) {
            this.longPositionTree = this.longPositionTree.remove(position.liquidationPrice);
        } else {
            this.shortPositionTree = this.shortPositionTree.remove(position.liquidationPrice);
        }
    }

    private reject(code: EVENT_REJECT_CODES, message: string): never {
        throw new RejectError(code, message);
    }

    // ----------------------

    createSnapshot(): PositionSnapshot {
        return {
            symbol: this.market.symbol,
            positions: Array.from(this.positionById.values()).map((position) => structuredClone(position)),
        };
    }

    restoreSnapshot(snapshot: PositionSnapshot) {
        this.positionByUserId = new Map();
        this.positionById = new Map();
        this.longPositionBucket = new Map();
        this.shortPositionBucket = new Map();
        this.longPositionTree = createRBTree<number, boolean>();
        this.shortPositionTree = createRBTree<number, boolean>();

        for (const position of snapshot.positions) {
            const restored = structuredClone(position);
            this.positionByUserId.set(restored.userId, restored.positionId);
            this.positionById.set(restored.positionId, restored);
            this.addLiquidationIndex(restored);
        }
    }

    // ----------------------

    getLiquidatablePositions(indexPrice: number): UserPositionType[] {
        const positions: UserPositionType[] = [];
        const long = this.longPositionTree.ge(indexPrice);
        while (long.valid) {
            const liquidationPrice = long.key;
            if (liquidationPrice !== undefined) {
                this.appendBucketPositions(this.longPositionBucket.get(liquidationPrice), positions)
            }
            long.next();
        }

        const short = this.shortPositionTree.le(indexPrice);
        while (short.valid) {
            const liquidationPrice = short.key;
            if (liquidationPrice !== undefined) {
                this.appendBucketPositions(this.shortPositionBucket.get(liquidationPrice), positions)
            }
            short.prev();
        }

        return positions;

    }

    // ----------------------

    getPosition(userId: string): UserPositionType | undefined {
        const positionId = this.positionByUserId.get(userId);
        return positionId ? this.positionById.get(positionId) : undefined;
    }

    getADLCandidates(oppositeSide: OrderPosition, referencePrice: number): UserPositionType[] {
        const candidates: UserPositionType[] = [];

        for (const position of this.positionById.values()) {
            if (position.position === oppositeSide) {
                candidates.push(position);
            }
        }

        candidates.sort((a, b) => this.unrealizedPnl(b, referencePrice) - this.unrealizedPnl(a, referencePrice));

        return candidates;
    }

    private unrealizedPnl(position: UserPositionType, price: number): number {
        const diff = (price - position.averagePrice) * position.quantity;
        return position.position === OrderPosition.LONG ? diff : -diff;
    }

    // ----------------------
    applyFunding(fundingRateBps: number) {

        if (!Number.isFinite(fundingRateBps)) {
            throw new Error("Invalid funding rate");
        }

        let usedInsuranceFund = 0;
        let payments = 0;

        if (fundingRateBps === 0) {
            return { fundingRateBps, payments, usedInsuranceFund }
        }

        for (const position of this.positionById.values()) {
            const amount = this.fundingAmount(position, fundingRateBps);

            if (amount === 0) {
                continue;
            }

            const fundingPaySide = fundingRateBps > 0 ? position.position === OrderPosition.LONG : position.position === OrderPosition.SHORT;

            this.removeLiquidationPrice(position);

            // LONG PAYS SHORT
            // SHORT PAYS LONG
            if (fundingPaySide) {
                const deducted = amount < position.margin ? amount : position.margin;
                const deficit = amount - deducted;
                position.margin -= deducted;
                this.adjustPositionCollateral(position.userId, -deducted);

                if (deficit > 0) {
                    this.fundManagementEngine.useInsuranceFund(this.market.symbol, deficit);
                    usedInsuranceFund += deficit;
                }
            }
            else {
                position.margin += amount;
                this.adjustPositionCollateral(position.userId, amount);
            }

            this.updateDerivedFields(position);
            this.addLiquidationIndex(position);
            this.updateManagerEngine.capturePosition(position);

            payments++;
        }

        return { fundingRateBps, payments, usedInsuranceFund }
    }

    private fundingAmount(postion: UserPositionType, fundingRateBps: number) {
        const absoluteRate = fundingRateBps < 0 ? -fundingRateBps : fundingRateBps;
        return (postion.averagePrice * postion.quantity * absoluteRate) / 10_000;
    }

    private adjustPositionCollateral(userId: string, amount: number) {
        const balances = this.state.balances.get(userId);
        if (!balances) {
            this.reject(EVENT_REJECT_CODES.USER_DOESNT_EXISTS, "User not found");
        }

        let balance = balances.get(this.market.quoteAsset.symbol);

        if (!balance) {
            balance = { total: 0, locked: 0 };
            balances.set(this.market.quoteAsset.symbol, balance);
        }
        balance.total += amount;
        balance.locked += amount;
    }

    private appendBucketPositions(bucket: Set<string> | undefined, positions: UserPositionType[]) {
        if (!bucket) {
            return;
        }

        for (const positionId of bucket) {
            const position = this.positionById.get(positionId);
            if (position) {
                positions.push(position);
            }
        }
    }

}