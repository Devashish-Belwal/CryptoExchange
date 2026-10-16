import { Asset, BalanceChangeSide, BalanceChangeType, BalanceReturnType, BaseBalanceType, EVENT_REJECT_CODES, InMarketFillType, Market, MarketOrderType, MarketType, OffRampBalanceRequestPayload, OnRampBalanceRequestPayload, OrderSide, OrderStatus, OrderType, TimeInForce, UserAddRequestPayload } from "@workspace/shared";
import { RejectError } from "../utils/error";
import { UpdateManagerEngine } from "./update-manager-engine";
import { FundManagementEngine } from "./fund-management-engine";
import { EngineState } from "./engine-state";

export class BalanceEngine {

    constructor(private readonly state: EngineState,
        private readonly updateManagerEngine: UpdateManagerEngine,
        private readonly fundManagementEngine: FundManagementEngine,
    ) { }

    addUser(payload: UserAddRequestPayload) {
        if (this.state.balances.has(payload.userId)) {
            return this.reject(EVENT_REJECT_CODES.USER_ALREADY_EXISTS, "User already exists");
        }

        const balance: BaseBalanceType = new Map();
        const assets = this.state.assets;

        for (const asset of assets.keys()) {
            balance.set(asset, { total: 0, locked: 0 });
        }

        this.state.balances.set(payload.userId, balance);

        return { success: true, message: "User Added Successfully" };
    }

    getUserBalance(userId: string): BalanceReturnType {
        const balances = this.state.balances.get(userId);

        if (!balances) {
            return this.reject(EVENT_REJECT_CODES.USER_DOESNT_EXISTS, "No balances found for the user");
        }

        const balanceReturn = Object.fromEntries(
            Array.from(balances.entries()).map(([asset, balance]) => {
                return [
                    asset, {
                        total: balance.total, locked: balance.locked
                    }
                ]
            })
        )

        return balanceReturn;
    }

    onRampBalance(payload: OnRampBalanceRequestPayload) {
        const { userId, symbol, amount } = payload;

        const balances = this.state.balances.get(userId);

        if (!balances) {
            return this.reject(EVENT_REJECT_CODES.USER_DOESNT_EXISTS, "No balances found for the user");
        }

        if (Number(amount) <= 0) {
            return this.reject(EVENT_REJECT_CODES.INVALID_AMOUNT, "Amount must be greater than zero");
        }

        const existingAssetBalance = this.getOrCreateBalance(balances, symbol);
        existingAssetBalance.total += Number(amount);

        return {
            symbol,
            amount,
            total: existingAssetBalance.total,
            locked: existingAssetBalance.locked
        }
    }

    offRampBalance(payload: OffRampBalanceRequestPayload) {
        const { userId, symbol, amount } = payload;

        const balances = this.state.balances.get(userId);

        if (!balances) {
            return this.reject(EVENT_REJECT_CODES.USER_DOESNT_EXISTS, "No balances found for the user");
        }

        if (Number(amount) <= 0) {
            return this.reject(EVENT_REJECT_CODES.INVALID_AMOUNT, "Amount must be greater than zero");
        }

        const existingAssetBalance = this.getOrCreateBalance(balances, symbol);

        if (existingAssetBalance.total - existingAssetBalance.locked < Number(amount)) {
            return this.reject(EVENT_REJECT_CODES.INSUFFICIENT_BALANCE, "Insufficient available balance");
        }

        existingAssetBalance.total -= Number(amount);

        return {
            symbol,
            amount,
            total: existingAssetBalance.total,
            locked: existingAssetBalance.locked
        }
    }

    // -----------------------

    lockBalance(order: MarketOrderType): number {
        const market = this.state.markets.get(order.symbol);

        if (!market) {
            return this.reject(EVENT_REJECT_CODES.INVALID_MARKET, "Market not found");
        }

        const userBalances = this.state.balances.get(order.userId);

        if (!userBalances) {
            return this.reject(EVENT_REJECT_CODES.USER_DOESNT_EXISTS, "No balances found for the user");
        }

        if (order.marketType === MarketType.PERP) {
            if (!order.leverage) {
                return this.reject(EVENT_REJECT_CODES.INVALID_LEVERAGE, "Leverage required in perp order");
            }

            const amount = order.reduceOnly ? 0 :
                order.type === OrderType.MARKET ?
                    this.bufferPerpMarginForMarketOrder(order.quantity, order.entryPrice, order.leverage) :
                    this.requiredPerpMargin(order);
            this.lock(userBalances, market.quoteAsset, amount);

            this.updateManagerEngine.captureBalanceUpdate(
                order.userId,
                market.quoteAsset.symbol,
                amount,
                BalanceChangeSide.TRANSFER,
                BalanceChangeType.LOCK,
                order.orderId,
                order.symbol
            )

            return amount;
        }

        if (order.side === OrderSide.BUY) {
            const lockAmount = this.requiredSpotBuyBalance(order.quantity, order.entryPrice, false);
            this.lock(userBalances, market.quoteAsset, lockAmount);

            this.updateManagerEngine.captureBalanceUpdate(
                order.userId,
                market.quoteAsset.symbol,
                lockAmount,
                BalanceChangeSide.TRANSFER,
                BalanceChangeType.LOCK,
                order.orderId,
                order.symbol
            )
            return lockAmount;
        }

        this.lock(userBalances, market.baseAsset, order.quantity);
        this.updateManagerEngine.captureBalanceUpdate(
            order.userId,
            market.baseAsset.symbol,
            order.quantity,
            BalanceChangeSide.TRANSFER,
            BalanceChangeType.LOCK,
            order.orderId,
            order.symbol
        )

        return order.quantity;
    }

    private lock(balances: BaseBalanceType, asset: Asset, amount: number) {
        if (amount < 0) {
            return this.reject(EVENT_REJECT_CODES.INVALID_AMOUNT, "Amount must be greater than zero");
        }

        // A reduceOnly order intentionally locks zero new margin (lockBalance passes
        // amount=0 for it) - that's a valid no-op, not an error. Rejecting it here
        // made every reduceOnly PERP order fail unconditionally.
        if (amount === 0) return;

        const balance = this.getOrCreateBalance(balances, asset.symbol);

        if (balance.total - balance.locked < amount) {
            return this.reject(EVENT_REJECT_CODES.INSUFFICIENT_BALANCE, "Insufficient available balance");
        }

        balance.locked += amount;
    }

    private requiredPerpMargin(order: MarketOrderType) {
        if (order.marketType === MarketType.SPOT || !order.leverage) {
            return 0;
        }

        return Math.ceil((order.quantity * order.entryPrice) / order.leverage);
    }

    private bufferPerpMarginForMarketOrder(quantity: number, price: number, leverage: number) {
        const notional = Math.ceil(quantity * price);
        return Math.ceil((notional * 1.05) / leverage);
    }

    // ------------------------

    // FOR RELEASE OR UPDATE BALANCES FROM THE ORDER AFTER MATCH
    releaseUnusedBalance(order: MarketOrderType) {
        const market = this.state.markets.get(order.symbol);

        if (!market) {
            return this.reject(EVENT_REJECT_CODES.INVALID_MARKET, "Market not found");
        }

        if (!this.shouldKeppRestingLock(order)) {
            if (order.marketType === MarketType.PERP) {
                this.releasePerpOrderReservation(order, market);
                return;
            }
            this.releaseSpotOrderReservation(order, market);
        }
    }

    private shouldKeppRestingLock(order: MarketOrderType) {
        return order.type === OrderType.LIMIT &&
            order.timeInForce === TimeInForce.GTC &&
            (order.status === OrderStatus.OPEN || order.status === OrderStatus.PARTIAL_FILLED)
    }

    private releasePerpOrderReservation(order: MarketOrderType, market: Market) {
        const userBalances = this.state.balances.get(order.userId);

        if (!userBalances) {
            return this.reject(EVENT_REJECT_CODES.USER_DOESNT_EXISTS, "No balances found for the user");
        }

        const availableOrderBalance = order.balance.allotted - order.balance.released - order.balance.used;
        this.unlock(userBalances, market.quoteAsset, availableOrderBalance);
        order.balance.released += availableOrderBalance;

        if (availableOrderBalance > 0) {
            this.updateManagerEngine.captureBalanceUpdate(
                order.userId,
                market.quoteAsset.symbol,
                availableOrderBalance,
                BalanceChangeSide.TRANSFER,
                BalanceChangeType.RELEASE,
                order.orderId,
                order.symbol
            )
        }

    }

    private releaseSpotOrderReservation(order: MarketOrderType, market: Market) {
        const userBalances = this.state.balances.get(order.userId);

        if (!userBalances) {
            return this.reject(EVENT_REJECT_CODES.USER_DOESNT_EXISTS, "No balances found for the user");
        }

        const availableOrderBalance = order.balance.allotted - order.balance.released - order.balance.used;

        if (order.side === OrderSide.BUY) {
            const quoteNotional = Math.ceil(order.remainingQuantity * order.entryPrice);
            const fees = this.fillFees(quoteNotional, true);
            const remianingAmount = quoteNotional + fees;
            const release = availableOrderBalance > remianingAmount ? availableOrderBalance - remianingAmount : 0;
            this.unlock(userBalances, market.quoteAsset, release);
            if (release > 0) {
                this.updateManagerEngine.captureBalanceUpdate(
                    order.userId,
                    market.quoteAsset.symbol,
                    release,
                    BalanceChangeSide.TRANSFER,
                    BalanceChangeType.RELEASE,
                    order.orderId,
                    order.symbol
                )
            }
            order.balance.released += release;

        } else {
            const remainingQuantity = order.remainingQuantity;
            const release = availableOrderBalance > remainingQuantity ? availableOrderBalance - remainingQuantity : 0;
            this.unlock(userBalances, market.baseAsset, release);
            if (release > 0) {
                this.updateManagerEngine.captureBalanceUpdate(
                    order.userId,
                    market.baseAsset.symbol,
                    release,
                    BalanceChangeSide.TRANSFER,
                    BalanceChangeType.RELEASE,
                    order.orderId,
                    order.symbol
                )
            }
            order.balance.released += release;
        }
    }

    // -----------------------

    // FOR RELEASE PAYMENT FOR CANCELLED ORDERS
    releaseCancelledOrderBalances(order: MarketOrderType) {
        const market = this.state.markets.get(order.symbol);

        if (!market) {
            return this.reject(EVENT_REJECT_CODES.INVALID_MARKET, "Market not found");
        }

        const userBalances = this.state.balances.get(order.userId);

        if (!userBalances) {
            return this.reject(EVENT_REJECT_CODES.USER_DOESNT_EXISTS, "No balances found for the user");
        }

        const releasableBalance = Math.max(0, order.balance.allotted - order.balance.released - order.balance.used);

        if (order.marketType === MarketType.PERP || order.side === OrderSide.BUY) {
            this.unlock(userBalances, market.quoteAsset, releasableBalance);
            order.balance.released += releasableBalance;
        } else {
            this.unlock(userBalances, market.baseAsset, releasableBalance);
            order.balance.released += releasableBalance;
        }

        if (releasableBalance > 0) {
            this.updateManagerEngine.captureBalanceUpdate(
                order.userId,
                order.side === OrderSide.BUY ? market.quoteAsset.symbol : market.baseAsset.symbol,
                releasableBalance,
                BalanceChangeSide.TRANSFER,
                BalanceChangeType.RELEASE,
                order.orderId,
                order.symbol
            )
        }
    }


    // -----------------------

    // FOR APPLY FILL BALANCE CHANGES TO MAKER AND TAKER ORDERS
    applyFills(fill: InMarketFillType, taker: MarketOrderType, maker: MarketOrderType) {

        const market = this.state.markets.get(taker.symbol);

        if (!market) {
            return this.reject(EVENT_REJECT_CODES.INVALID_MARKET, "Market not found");
        }

        const quoteNotional = Math.ceil(fill.qty * fill.price);

        if (taker.marketType === MarketType.PERP) {
            const makerFees = this.fillFees(quoteNotional, true, maker.liquidation);
            const takerFees = this.fillFees(quoteNotional, false, maker.liquidation);
            fill.makerFee = makerFees;
            fill.takerFee = takerFees;

            this.applyPerpFills(taker, takerFees, market, fill.tradeId);
            this.applyPerpFills(maker, makerFees, market, fill.tradeId);

            return;
        } else {
            const makerFees = this.fillFees(quoteNotional, true);
            const takerFees = this.fillFees(quoteNotional, false);
            fill.makerFee = makerFees;
            fill.takerFee = takerFees;

            this.applySpotFills(taker, fill.price, fill.qty, takerFees, market, fill.tradeId);
            this.applySpotFills(maker, fill.price, fill.qty, makerFees, market, fill.tradeId);
        }
    }

    applySpotFills(order: MarketOrderType, price: number, qty: number, fee: number, market: Market, tradeId: number) {
        const userBalances = this.state.balances.get(order.userId);

        if (!userBalances) {
            return this.reject(EVENT_REJECT_CODES.USER_DOESNT_EXISTS, "No balances found for the user");
        }

        const quoteBalance = this.getOrCreateBalance(userBalances, market.quoteAsset.symbol);
        const baseBalance = this.getOrCreateBalance(userBalances, market.baseAsset.symbol);
        const quoteNotional = Math.ceil(qty * price);

        if (order.side === OrderSide.BUY) {
            this.reduceLockedBalance(quoteBalance, quoteNotional + fee);
            baseBalance.total += qty;
            this.fundManagementEngine.addCommissionFee(order.symbol, fee);

            // quote spent
            this.updateManagerEngine.captureBalanceUpdate(
                order.userId,
                market.quoteAsset.symbol,
                quoteNotional + fee,
                BalanceChangeSide.DEBIT,
                BalanceChangeType.TRADE,
                order.orderId,
                order.symbol,
                String(tradeId)
            )

            // base received
            this.updateManagerEngine.captureBalanceUpdate(
                order.userId,
                market.baseAsset.symbol,
                qty,
                BalanceChangeSide.CREDIT,
                BalanceChangeType.TRADE,
                order.orderId,
                order.symbol,
                String(tradeId)
            )
            return;
        } else {
            this.reduceLockedBalance(baseBalance, qty);
            quoteBalance.total += quoteNotional - fee;
            this.fundManagementEngine.addCommissionFee(order.symbol, fee);

            // base spent
            this.updateManagerEngine.captureBalanceUpdate(
                order.userId,
                market.baseAsset.symbol,
                qty,
                BalanceChangeSide.DEBIT,
                BalanceChangeType.TRADE,
                order.orderId,
                order.symbol,
                String(tradeId)
            )

            // quote received
            this.updateManagerEngine.captureBalanceUpdate(
                order.userId,
                market.quoteAsset.symbol,
                quoteNotional - fee,
                BalanceChangeSide.CREDIT,
                BalanceChangeType.TRADE,
                order.orderId,
                order.symbol,
                String(tradeId)
            )
        }
    }

    applyPerpFills(order: MarketOrderType, fee: number, market: Market, tradeId: number) {
        if (fee <= 0) {
            return;
        }
        const userBalances = this.state.balances.get(order.userId);

        if (!userBalances) {
            return this.reject(EVENT_REJECT_CODES.USER_DOESNT_EXISTS, "No balances found for the user");
        }

        const quoteBalance = this.getOrCreateBalance(userBalances, market.quoteAsset.symbol);
        const availableBalance = quoteBalance.total - quoteBalance.locked;
        const fees = availableBalance < fee ? availableBalance : fee;
        quoteBalance.total -= fees;
        this.fundManagementEngine.addCommissionFee(order.symbol, fees);

        // fee charged from quote asset
        this.updateManagerEngine.captureBalanceUpdate(
            order.userId,
            market.quoteAsset.symbol,
            fee,
            BalanceChangeSide.DEBIT,
            BalanceChangeType.TRADE,
            order.orderId,
            order.symbol,
            String(tradeId)
        )
    }

    private reduceLockedBalance(balance: { total: number, locked: number }, amount: number) {
        if (amount <= 0) {
            return;
        }

        if (balance.locked < amount || balance.total < amount) {
            this.reject(EVENT_REJECT_CODES.INSUFFICIENT_BALANCE, "Locked balance underflow");
        }

        balance.locked -= amount;
        balance.total -= amount;
    }

    private floorToLotSize(qty: number, market: Market) {
        const lotSize = market.lotSize;

        return lotSize > 0 ? qty - (qty % lotSize) : 0;
    }

    // -----------------------

    // FOR ANY ORDER ERROR
    releaseBalance(order: MarketOrderType, initialLock: number) {
        const market = this.state.markets.get(order.symbol);

        if (!market) {
            return this.reject(EVENT_REJECT_CODES.INVALID_MARKET, "Market not found");
        }

        const userBalances = this.state.balances.get(order.userId);

        if (!userBalances) {
            return this.reject(EVENT_REJECT_CODES.USER_DOESNT_EXISTS, "No balances found for the user");
        }

        if (order.marketType === MarketType.PERP || order.side === OrderSide.BUY) {
            this.unlock(userBalances, market.quoteAsset, initialLock);
            this.updateManagerEngine.discardBalanceUpdates();
            return;
        }
        this.unlock(userBalances, market.baseAsset, order.quantity);
        this.updateManagerEngine.discardBalanceUpdates();
    }

    // -----------------------

    private getOrCreateBalance(balances: BaseBalanceType, asset: string) {
        let balance = balances.get(asset);

        if (!balance) {
            balance = { total: 0, locked: 0 };
            balances.set(asset, balance);
        }

        return balance;
    }

    private fillFees(notional: number, maker: boolean, liquidation = false) {
        const basisPoints = liquidation ? 50 : maker ? 1 : 2;

        if (notional === 0) {
            return 0;
        }

        return Math.ceil((notional * basisPoints) / 10000);
    }

    private unlock(balances: BaseBalanceType, asset: Asset, amount: number) {
        if (amount <= 0) { return; }

        const balance = this.getOrCreateBalance(balances, asset.symbol);
        balance.locked = amount > balance.locked ? 0 : balance.locked - amount;
    }

    // -----------------------

    prepareFill(maker: MarketOrderType, taker: MarketOrderType, requestedQty: number, price: number, market: Market): {
        qty: number;
        reservationRejected: boolean;
        makerLimited: boolean;
    } {
        const makerQty = this.getFillableQty(maker, requestedQty, price, market, true);
        const takerQty = this.getFillableQty(taker, requestedQty, price, market, false);
        const qty = Math.min(makerQty, takerQty);
        const makerLimited = makerQty < takerQty;

        if (qty <= 0) {
            return {
                qty: 0,
                reservationRejected: true,
                makerLimited,
            };
        }

        this.reserveFillBalance(maker, qty, price, true);
        this.reserveFillBalance(taker, qty, price, false);

        return {
            qty,
            reservationRejected: qty < requestedQty,
            makerLimited,
        };
    }

    private getFillableQty(order: MarketOrderType, requestedQty: number, price: number, market: Market, maker: boolean): number {
        if (requestedQty <= 0) return 0;

        const requestedRequired = this.requiredFillBalance(order, requestedQty, price, maker);

        if (requestedRequired <= 0) return requestedQty;

        const available = this.getOrderAvailableBalance(order);

        if (available <= 0) return 0;

        if (requestedRequired <= available) {
            return requestedQty;
        }

        const maxSteps = this.getQtySteps(requestedQty, market);
        let low = 0;
        let high = maxSteps;

        while (low < high) {
            const mid = Math.floor((low + high + 1) / 2);
            const qty = this.qtyFromSteps(mid, market);
            const required = this.requiredFillBalance(order, qty, price, maker);

            if (required <= available) {
                low = mid;
            } else {
                high = mid - 1;
            }
        }

        return this.qtyFromSteps(low, market);
    }

    private reserveFillBalance(order: MarketOrderType, qty: number, price: number, maker: boolean) {
        const required = this.requiredFillBalance(order, qty, price, maker);
        const available = this.getOrderAvailableBalance(order);

        if (required > available) {
            return this.reject(EVENT_REJECT_CODES.INSUFFICIENT_BALANCE, "Order reservation underflow");
        }

        order.balance.used += required;
    }

    private getOrderAvailableBalance(order: MarketOrderType): number {
        return order.balance.allotted - order.balance.released - order.balance.used;
    }

    private requiredFillBalance(order: MarketOrderType, qty: number, price: number, maker: boolean): number {
        if (order.reduceOnly) return 0;

        if (order.marketType === MarketType.PERP) {
            return this.requiredPerpBuyBalance(qty, price, order.leverage!);
        }

        if (order.side === OrderSide.BUY) {
            return this.requiredSpotBuyBalance(qty, price, maker);
        }

        return qty;
    }

    private getQtySteps(qty: number, market: Market): number {
        if (market.lotSize <= 0) return 0;

        return Math.floor(qty / market.lotSize);
    }

    private qtyFromSteps(steps: number, market: Market): number {
        return this.floorToLotSize(steps * market.lotSize, market);
    }

    private requiredSpotBuyBalance(qty: number, price: number, maker: boolean) {
        const notional = Math.ceil(price * qty);
        return notional + this.fillFees(notional, maker);
    }

    private requiredPerpBuyBalance(qty: number, price: number, leverage: number) {
        return Math.ceil((qty * price) / leverage);
    }

    // -----------------------
    releasePerpCollateral(userId: string, marginToUnlock: number, pnl: number, market: Market, orderId?: string, tradeId?: number, deficit: number = 0): number {
        if (marginToUnlock === 0 && pnl === 0 && deficit === 0) { return 0; }

        const userBalances = this.state.balances.get(userId);

        if (!userBalances) {
            return this.reject(EVENT_REJECT_CODES.USER_DOESNT_EXISTS, "No balances found for the user");
        }

        let covered = 0;

        if (deficit > 0) {
            const available = this.state.insuranceFunds.get(market.symbol) ?? 0;

            if (available < deficit) {
                return this.reject(EVENT_REJECT_CODES.INSURANCE_FUND_DEPLETED, "Insurance fund cannot cover the liquidation deficit");
            }

            covered = deficit;
            this.fundManagementEngine.useInsuranceFund(market.symbol, covered);
        }

        const balance = this.getOrCreateBalance(userBalances, market.quoteAsset.symbol);

        if (marginToUnlock > balance.locked) {
            this.reject(EVENT_REJECT_CODES.INTERNAL_ERROR, "Locked collateral underflow");
        }

        const totalCredit = pnl + covered;

        balance.locked -= marginToUnlock;
        balance.total += totalCredit;

        if (marginToUnlock > 0) {
            this.updateManagerEngine.captureBalanceUpdate(
                userId,
                market.quoteAsset.symbol,
                marginToUnlock,
                BalanceChangeSide.TRANSFER,
                BalanceChangeType.RELEASE,
                orderId,
                market.symbol,
                tradeId ? String(tradeId) : undefined
            );
        }

        if (totalCredit !== 0) {
            this.updateManagerEngine.captureBalanceUpdate(
                userId,
                market.quoteAsset.symbol,
                Math.abs(totalCredit),
                totalCredit > 0 ? BalanceChangeSide.CREDIT : BalanceChangeSide.DEBIT,
                BalanceChangeType.TRADE,
                orderId,
                market.symbol,
                tradeId ? String(tradeId) : undefined
            );
        }

        return covered;
    }

    // -----------------------

    private reject(code: EVENT_REJECT_CODES, message: string): never {
        throw new RejectError(code, message);
    }

}
