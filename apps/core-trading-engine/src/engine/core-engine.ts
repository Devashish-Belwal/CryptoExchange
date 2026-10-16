import { AddAssetEngineResponse, AddAssetRequestPayload, AddMarketEngineResponse, AddMarketRequestPayload, BalanceChangeSide, BalanceChangeType, CancelOrderEngineResponse, CancelOrderRequestPayload, CreateOrderEngineResponse, CreateOrderRequestPayload, DefaultEngineResponse, DeleteAllOpenOrderOrderEngineResponse, DeleteAllOpenOrderRequestPayload, DeleteAssetEngineResponse, DeleteAssetRequestPayload, DeleteMarketEngineResponse, DeleteMarketRequestPayload, EngineHealthCheckRequestPayload, EngineRequestUnion, EngineResponseUnion, EngineSnapshot, EVENT_REJECT_CODES, EVENT_SUBJECT, FundingUpdateEventPayload, FundingUpdateEngineResponse, GetAllOpenOrderOrderEngineResponse, GetAllOpenOrderRequestPayload, GetAllTickerEngineResponse, GetAllTickerEventPayload, GetMarketDepthOrderEngineResponse, GetMarketDepthRequestPayload, GetOneOpenOrderOrderEngineResponse, GetOneOpenOrderRequestPayload, GetOneTickerEngineResponse, GetOneTickerEventPayload, GetUserBalancesEngineResponse, GetUserBalancesRequestPayload, HealthCheckEngineResponse, IndexPriceUpdateEventPayload, IndexPriceUpdateEngineResponse, MarketOrderType, MarketType, OffRampBalanceRequestPayload, OffRampEngineResponse, OnRampBalanceRequestPayload, OnRampEngineResponse, OrderbookSnapshot, OrderPosition, OrderSide, OrderType, PositionSnapshot, R2Config, STPMode, TimeInForce, UpdateAssetEngineResponse, UpdateAssetRequestPayload, UpdateMarketEngineResponse, UpdateMarketRequestPayload, UserAddEngineResponse, UserAddRequestPayload, UserPositionType, GetOneMarketRiskEventPayload, GetOneMarketRiskEngineResponse, GetAllMarketRiskEventPayload, GetAllMarketRiskEngineResponse, GetAllMarketOpenInterestEngineResponse, GetOneMarketOpenInterestEngineResponse, GetOneMarketOpenInterestEventPayload, GetAllMarketOpenInterestEventPayload, GetUserOpenPositionEngineResponse, GetUserOpenPositionRequestPayload, GetAllUserOpenPositionEngineResponse, GetAllUserOpenPositionRequestPayload } from "@workspace/shared";
import { RejectError } from "../utils/error";
import { OMSEngine } from "./oms-engine";
import { OrderbookEngine } from "./single-orderbook";
import { PositionEngine } from "./single-position";
import { MarketEngine } from "./market-engine";
import { BalanceEngine } from "./balance-engine";
import { MatchingEngine } from "./matching-engine";
import { orderParseToMarket, orderParseToReturn } from "../utils/parser";
import { PositionMatchingEngine } from "./position-engine";
import { UpdateManagerEngine } from "./update-manager-engine";
import { FundManagementEngine } from "./fund-management-engine";
import { SnapshotEngine } from "./snapshot-engine";
import { EngineState } from "./engine-state";


export class Engine {
    eventSequenceId: number;

    private readonly state: EngineState;

    readonly snapshotEngine: SnapshotEngine;

    private readonly omsChecker: OMSEngine;

    private readonly marketEngine: MarketEngine;

    private readonly balanceEngine: BalanceEngine;

    private readonly matchingEngine: MatchingEngine;

    private readonly positionEngine: PositionMatchingEngine;

    private readonly updateManagerEngine: UpdateManagerEngine;

    private readonly fundManagementEngine: FundManagementEngine;

    private constructor() {
        this.eventSequenceId = 0;

        this.state = new EngineState();

        this.omsChecker = new OMSEngine(this.state);

        this.updateManagerEngine = new UpdateManagerEngine(this.state);

        this.fundManagementEngine = new FundManagementEngine(this.state, this.updateManagerEngine);

        this.balanceEngine = new BalanceEngine(this.state, this.updateManagerEngine, this.fundManagementEngine);

        this.matchingEngine = new MatchingEngine(this.state, this.balanceEngine);

        this.positionEngine = new PositionMatchingEngine(this.state, this.balanceEngine, this.updateManagerEngine, this.fundManagementEngine);

        this.marketEngine = new MarketEngine(this.state, this.matchingEngine, this.positionEngine, this.fundManagementEngine);

        this.snapshotEngine = new SnapshotEngine(this.state, this.createR2Config());
    }

    static async create(): Promise<Engine> {
        const engine = new Engine();

        const restored = await engine.snapshotEngine.restoreSnapshot();

        if (restored.success && restored.snapshot) {
            engine.applySnapshot(restored.snapshot);
            console.log("Engine state restored from latest R2 snapshot");
        } else {
            await engine.marketEngine.initializeMarkets();
            await engine.snapshotEngine.uploadSnapshot(engine.eventSequenceId);
            console.log("No snapshot found, engine initialized from database and snapshot saved");
        }

        return engine;
    }

    process = async (event: EngineRequestUnion): Promise<EngineResponseUnion> => {
        try {

            let result: EngineResponseUnion;
            switch (event.type) {
                case EVENT_SUBJECT.HEALTH_CHECK:
                    result = this.healtCheck(event.payload);
                    break;

                case EVENT_SUBJECT.ADD_ASSET:
                    result = this.addAsset(event.payload);
                    break;

                case EVENT_SUBJECT.UPDATE_ASSET:
                    result = this.updateAsset(event.payload);
                    break;

                case EVENT_SUBJECT.DELETE_ASSET:
                    result = this.deleteAsset(event.payload);
                    break;

                case EVENT_SUBJECT.ADD_MARKET:
                    result = this.addMarket(event.payload);
                    break;

                case EVENT_SUBJECT.UPDATE_MARKET:
                    result = this.updateMarket(event.payload);
                    break;

                case EVENT_SUBJECT.DELETE_MARKET:
                    result = this.deleteMarket(event.payload);
                    break;

                case EVENT_SUBJECT.USER_ADD:
                    result = this.addUser(event.payload);
                    break;

                case EVENT_SUBJECT.GET_BALANCES:
                    result = this.getUserBalances(event.payload);
                    break;

                case EVENT_SUBJECT.ON_RAMP:
                    result = this.onRampBalance(event.payload);
                    break;

                case EVENT_SUBJECT.OFF_RAMP:
                    result = this.offRampBalance(event.payload);
                    break;

                case EVENT_SUBJECT.ORDER_CREATE:
                    result = this.createOrder(event.payload);
                    break;

                case EVENT_SUBJECT.ORDER_CANCEL:
                    result = this.cancelOrder(event.payload);
                    break;

                case EVENT_SUBJECT.GET_ONE_OPEN_ORDER:
                    result = this.getOneOpenOrder(event.payload);
                    break;

                case EVENT_SUBJECT.GET_ALL_OPEN_ORDER:
                    result = this.getAllOpenOrder(event.payload);
                    break;

                case EVENT_SUBJECT.DELETE_ALL_OPEN_ORDER:
                    result = this.deleteAllOpenOrder(event.payload);
                    break;

                case EVENT_SUBJECT.GET_USER_OPEN_POSITION:
                    result = this.getUserPosition(event.payload);
                    break;

                case EVENT_SUBJECT.GET_ALL_USER_OPEN_POSITION:
                    result = this.getAllUserPositions(event.payload);
                    break;

                case EVENT_SUBJECT.GET_MARKET_DEPTH:
                    result = this.getMarketDepth(event.payload);
                    break;

                case EVENT_SUBJECT.GET_ONE_TICKER:
                    result = this.getOneTicker(event.payload);
                    break;

                case EVENT_SUBJECT.GET_ALL_TICKER:
                    result = this.getAllTicker(event.payload);
                    break;

                case EVENT_SUBJECT.INDEX_PRICE_UPDATE_EVENT:
                    result = this.indexPriceUpdate(event.payload);
                    // not added here as the index price updates very fast
                    break;

                case EVENT_SUBJECT.FUNDING_RATE_UPDATE_EVENT:
                    result = this.processFundingSettlment(event.payload);
                    break;

                case EVENT_SUBJECT.GET_ONE_MARKET_RISK:
                    result = this.getOneMarketRisk(event.payload);
                    break;

                case EVENT_SUBJECT.GET_ALL_MARKET_RISK:
                    result = this.getAllMarketRisk(event.payload);
                    break;

                case EVENT_SUBJECT.GET_ONE_OPEN_INTEREST:
                    result = this.getOneMarketOpenInterest(event.payload)
                    break;

                case EVENT_SUBJECT.GET_ALL_OPEN_INTEREST:
                    result = this.getAllMarketOpenInterest(event.payload)
                    break;

                default:
                    return this.internalError("No such event subject found", EVENT_REJECT_CODES.INTERNAL_ERROR);
            }

            const updates = this.updateManagerEngine.consume();
            if (updates) {
                result.updates = updates;
            }

            return result;

        } catch (error) {
            this.updateManagerEngine.reset();

            if (error instanceof RejectError) {
                return this.internalError(error.message, error.code, event.type);
            }

            console.error("Failed to process user request", error);

            return this.internalError("Unexpected internal error", EVENT_REJECT_CODES.INTERNAL_ERROR);

        }
    }

    private addAsset = (payload: AddAssetRequestPayload): AddAssetEngineResponse => {
        this.omsChecker.addAsset(payload);

        const asset = this.marketEngine.addAsset(payload);
        this.updateManagerEngine.captureAsset(payload);

        return {
            type: EVENT_SUBJECT.ADD_ASSET,
            success: true,
            userId: payload.userId,
            eventId: this.getUpdatedEventId(),
            timestamp: Date.now(),
            message: "Asset Added successfully successfully",
            payload: asset,
        }
    }

    private updateAsset = (payload: UpdateAssetRequestPayload): UpdateAssetEngineResponse => {

        this.omsChecker.updateAsset(payload);

        const asset = this.marketEngine.updateAsset(payload);
        this.updateManagerEngine.captureAsset(payload);

        return {
            type: EVENT_SUBJECT.UPDATE_ASSET,
            success: true,
            userId: payload.userId,
            eventId: this.getUpdatedEventId(),
            timestamp: Date.now(),
            message: "Asset Updated successfully successfully",
            payload: asset,
        }
    }

    private deleteAsset = (payload: DeleteAssetRequestPayload): DeleteAssetEngineResponse => {
        this.omsChecker.deleteAsset(payload);

        const asset = this.marketEngine.deleteAsset(payload);
        this.updateManagerEngine.captureAsset({ symbol: payload.symbol, isActive: false });

        return {
            type: EVENT_SUBJECT.DELETE_ASSET,
            success: true,
            userId: payload.userId,
            eventId: this.getUpdatedEventId(),
            timestamp: Date.now(),
            message: "Asset Updated successfully successfully",
            payload: asset,
        }

    }

    private addMarket = (payload: AddMarketRequestPayload): AddMarketEngineResponse => {
        this.omsChecker.addMarket(payload);
        const market = this.marketEngine.addMarket(payload);
        this.updateManagerEngine.captureMarket(payload);

        return {
            type: EVENT_SUBJECT.ADD_MARKET,
            success: true,
            userId: payload.userId,
            eventId: this.getUpdatedEventId(),
            timestamp: Date.now(),
            message: "Market Added successfully successfully",
            payload: market,
        }
    }

    private updateMarket = (payload: UpdateMarketRequestPayload): UpdateMarketEngineResponse => {
        this.omsChecker.updateMarket(payload);
        const market = this.marketEngine.updateMarket(payload);
        this.updateManagerEngine.captureMarket(payload);

        return {
            type: EVENT_SUBJECT.UPDATE_MARKET,
            success: true,
            userId: payload.userId,
            eventId: this.getUpdatedEventId(),
            timestamp: Date.now(),
            message: "Market Updated successfully successfully",
            payload: market,
        }
    }

    private deleteMarket = (payload: DeleteMarketRequestPayload): DeleteMarketEngineResponse => {
        this.omsChecker.deleteMarket(payload);

        const market = this.marketEngine.deleteMarket(payload);
        this.updateManagerEngine.captureMarket({ symbol: payload.symbol, isActive: false });

        return {
            type: EVENT_SUBJECT.DELETE_MARKET,
            success: true,
            userId: payload.userId,
            eventId: this.getUpdatedEventId(),
            timestamp: Date.now(),
            message: "Market Deleted successfully successfully",
            payload: market,
        }
    }

    private addUser = (payload: UserAddRequestPayload): UserAddEngineResponse => {

        this.balanceEngine.addUser(payload);
        // this.updateManagerEngine.captureUser(payload);

        return {
            type: EVENT_SUBJECT.USER_ADD,
            success: true,
            userId: payload.userId,
            message: "User Added successfully",
            eventId: this.getUpdatedEventId(),
            timestamp: Date.now(),
            payload: { userId: payload.userId, username: payload.username, email: payload.email },
        };
    }

    private getUserBalances = (payload: GetUserBalancesRequestPayload): GetUserBalancesEngineResponse => {
        const userBalances = this.balanceEngine.getUserBalance(payload.userId);

        return {
            type: EVENT_SUBJECT.GET_BALANCES,
            success: true,
            message: "User balances fetched successfully",
            userId: payload.userId,
            eventId: this.getUpdatedEventId(),
            timestamp: Date.now(),
            payload: { balances: userBalances }
        };
    }

    private onRampBalance = (payload: OnRampBalanceRequestPayload): OnRampEngineResponse => {
        this.omsChecker.RampBalance(payload);

        const updatedBalance = this.balanceEngine.onRampBalance(payload);
        this.updateManagerEngine.captureBalanceUpdate(
            payload.userId,
            payload.symbol,
            Number(payload.amount),
            BalanceChangeSide.CREDIT,
            BalanceChangeType.TRANSACTION,
        );

        return {
            type: EVENT_SUBJECT.ON_RAMP,
            success: true,
            message: "User balances fetched successfully",
            userId: payload.userId,
            eventId: this.getUpdatedEventId(),
            timestamp: Date.now(),
            payload: updatedBalance,
        };
    }

    private offRampBalance = (payload: OffRampBalanceRequestPayload): OffRampEngineResponse => {

        const updatedBalance = this.balanceEngine.offRampBalance(payload);
        this.updateManagerEngine.captureBalanceUpdate(
            payload.userId,
            payload.symbol,
            Number(payload.amount),
            BalanceChangeSide.DEBIT,
            BalanceChangeType.TRANSACTION,
        );

        return {
            type: EVENT_SUBJECT.OFF_RAMP,
            success: true,
            message: "User balances fetched successfully",
            userId: payload.userId,
            eventId: this.getUpdatedEventId(),
            timestamp: Date.now(),
            payload: updatedBalance,
        };
    }

    private createOrder = (payload: CreateOrderRequestPayload): CreateOrderEngineResponse => {
        let locked = false;
        let lockedAsset = 0;
        const parsedOrder: MarketOrderType = orderParseToMarket(payload);

        let orderbook: OrderbookEngine | undefined;
        let orderbookSnapshot: OrderbookSnapshot | undefined;
        let marketPositionEngine: PositionEngine | undefined;
        let positionSnapshot: PositionSnapshot | undefined;

        try {
            this.omsChecker.createOrderCheck(parsedOrder);
            const market = this.state.markets.get(parsedOrder.symbol);

            if (!market) {
                throw new RejectError(EVENT_REJECT_CODES.MARKET_NOT_FOUND, "Market to the given order not found");
            }

            // BALANCE LOCK
            const lockedAmount = this.balanceEngine.lockBalance(parsedOrder);
            lockedAsset = lockedAmount;
            locked = true;

            if (parsedOrder.marketType === MarketType.PERP) {
                parsedOrder.margin = lockedAmount;
            }

            const order: MarketOrderType = {
                ...parsedOrder,
                balance: {
                    allotted: lockedAmount,
                    used: 0,
                    released: 0,
                }
            }

            orderbook = this.state.orderbooks.get(parsedOrder.symbol);
            marketPositionEngine = this.state.positions.get(parsedOrder.symbol);
            orderbookSnapshot = orderbook?.createSnapshot();
            positionSnapshot = marketPositionEngine?.createSnapshot();

            // CREATE ORDER
            const { order: result, cancelledOrders, matchedOrders } = this.matchingEngine.createOrder(order);

            // HANDLE CANCELLED ORDERS
            for (const cancelledOrder of cancelledOrders) {
                this.balanceEngine.releaseCancelledOrderBalances(cancelledOrder);
            }

            // APPLY FILLS
            for (const fill of result.fills) {
                const makerOrder = matchedOrders.get(fill.makerOrderId);
                const takerOrder = matchedOrders.get(fill.takerOrderId);

                if (!makerOrder || !takerOrder) {
                    throw new RejectError(EVENT_REJECT_CODES.USER_DOESNT_EXISTS, "Matched order context missing");
                }

                if (order.marketType === MarketType.PERP) {
                    this.positionEngine.applyFills(fill, takerOrder, makerOrder);
                }

                this.balanceEngine.applyFills(fill, takerOrder, makerOrder);
            }

            // RELEASE UNUSED BALANCE
            this.balanceEngine.releaseUnusedBalance(result);

            // GET UPDATED ORDERS
            const updatedOrdersMap = new Map<string, MarketOrderType>();
            for (const [orderId, order] of matchedOrders) updatedOrdersMap.set(orderId, order);
            for (const cancelledOrder of cancelledOrders) updatedOrdersMap.set(cancelledOrder.orderId, cancelledOrder);

            this.updateManagerEngine.captureOrders(updatedOrdersMap.values(), result, market);

            const responseOrder = orderParseToReturn(result);

            return {
                type: EVENT_SUBJECT.ORDER_CREATE,
                success: true,
                userId: payload.userId,
                eventId: this.getUpdatedEventId(),
                timestamp: Date.now(),
                message: "Order created successfully",
                payload: responseOrder,
            }

        } catch (error) {
            if (orderbook && orderbookSnapshot) {
                orderbook.restoreSnapshot(orderbookSnapshot);
            }

            if (marketPositionEngine && positionSnapshot) {
                marketPositionEngine.restoreSnapshot(positionSnapshot);
            }

            if (locked) {
                this.balanceEngine.releaseBalance(parsedOrder, lockedAsset);
            }

            if (error instanceof RejectError) {
                return {
                    type: EVENT_SUBJECT.ORDER_CREATE,
                    success: false,
                    userId: payload.userId,
                    eventId: this.getUpdatedEventId(),
                    timestamp: Date.now(),
                    message: error.message,
                    rejectCode: error.code,
                    payload: undefined,
                };

            }

            console.error(error);

            return {
                type: EVENT_SUBJECT.ORDER_CREATE,
                success: false,
                userId: payload.userId,
                eventId: this.getUpdatedEventId(),
                timestamp: Date.now(),
                message: "Unexpected internal error",
                rejectCode: EVENT_REJECT_CODES.INTERNAL_ERROR,
                payload: undefined,
            };

        }
    }

    private cancelOrder = (payload: CancelOrderRequestPayload): CancelOrderEngineResponse => {
        try {
            this.omsChecker.cancelOrderCheck(payload);

            const { order, market } = this.matchingEngine.cancelOrder(payload);

            this.balanceEngine.releaseCancelledOrderBalances(order);

            this.updateManagerEngine.captureOrder(order, market);

            return {
                type: EVENT_SUBJECT.ORDER_CANCEL,
                success: true,
                userId: payload.userId,
                eventId: this.getUpdatedEventId(),
                timestamp: Date.now(),
                message: "Order cancelled successfully",
                payload: { orderId: order.orderId },
            };

        } catch (error) {

            if (error instanceof RejectError) {
                return {
                    type: EVENT_SUBJECT.ORDER_CANCEL,
                    success: false,
                    userId: payload.userId,
                    eventId: this.getUpdatedEventId(),
                    timestamp: Date.now(),
                    message: error.message,
                    rejectCode: error.code,
                    payload: undefined,
                };
            }

            console.error(error);

            return {
                type: EVENT_SUBJECT.ORDER_CANCEL,
                success: false,
                userId: payload.userId,
                eventId: this.getUpdatedEventId(),
                timestamp: Date.now(),
                message: "Unexpected internal error",
                rejectCode: EVENT_REJECT_CODES.INTERNAL_ERROR,
                payload: undefined,
            };

        }
    }

    private getOneOpenOrder = (payload: GetOneOpenOrderRequestPayload): GetOneOpenOrderOrderEngineResponse => {
        try {

            const order = this.matchingEngine.getOneOpenOrder(payload);
            const parsedOrder = orderParseToReturn(order);

            return {
                type: EVENT_SUBJECT.GET_ONE_OPEN_ORDER,
                success: true,
                userId: payload.userId,
                eventId: this.getUpdatedEventId(),
                timestamp: Date.now(),
                message: "Order cancelled successfully",
                payload: { order: parsedOrder },
            };

        } catch (error) {

            if (error instanceof RejectError) {
                return {
                    type: EVENT_SUBJECT.GET_ONE_OPEN_ORDER,
                    success: false,
                    userId: payload.userId,
                    eventId: this.getUpdatedEventId(),
                    timestamp: Date.now(),
                    message: error.message,
                    rejectCode: error.code,
                    payload: undefined,
                };
            }

            console.error(error);

            return {
                type: EVENT_SUBJECT.GET_ONE_OPEN_ORDER,
                success: false,
                userId: payload.userId,
                eventId: this.getUpdatedEventId(),
                timestamp: Date.now(),
                message: "Unexpected internal error",
                rejectCode: EVENT_REJECT_CODES.INTERNAL_ERROR,
                payload: undefined,
            };

        }
    }

    private getAllOpenOrder = (payload: GetAllOpenOrderRequestPayload): GetAllOpenOrderOrderEngineResponse => {
        try {

            const orders = this.matchingEngine.getAllOpenOrder(payload);

            return {
                type: EVENT_SUBJECT.GET_ALL_OPEN_ORDER,
                success: true,
                userId: payload.userId,
                eventId: this.getUpdatedEventId(),
                timestamp: Date.now(),
                message: "Order cancelled successfully",
                payload: { orders },
            };

        } catch (error) {

            if (error instanceof RejectError) {
                return {
                    type: EVENT_SUBJECT.GET_ALL_OPEN_ORDER,
                    success: false,
                    userId: payload.userId,
                    eventId: this.getUpdatedEventId(),
                    timestamp: Date.now(),
                    message: error.message,
                    rejectCode: error.code,
                    payload: undefined,
                };
            }

            console.error(error);

            return {
                type: EVENT_SUBJECT.GET_ALL_OPEN_ORDER,
                success: false,
                userId: payload.userId,
                eventId: this.getUpdatedEventId(),
                timestamp: Date.now(),
                message: "Unexpected internal error",
                rejectCode: EVENT_REJECT_CODES.INTERNAL_ERROR,
                payload: undefined,
            };

        }
    }

    private deleteAllOpenOrder = (payload: DeleteAllOpenOrderRequestPayload): DeleteAllOpenOrderOrderEngineResponse => {
        try {

            const data = this.matchingEngine.deleteAllOpenOrder(payload);

            if (data.result.length > 0) {
                for (const order of data.result) {
                    this.balanceEngine.releaseCancelledOrderBalances(order);
                }
                this.updateManagerEngine.captureOrders(data.result, data.result[data.result.length - 1]!, data.market);
            }

            return {
                type: EVENT_SUBJECT.DELETE_ALL_OPEN_ORDER,
                success: true,
                userId: payload.userId,
                eventId: this.getUpdatedEventId(),
                timestamp: Date.now(),
                message: "Order cancelled successfully",
                payload: { ...data },
            };

        } catch (error) {

            if (error instanceof RejectError) {
                return {
                    type: EVENT_SUBJECT.DELETE_ALL_OPEN_ORDER,
                    success: false,
                    userId: payload.userId,
                    eventId: this.getUpdatedEventId(),
                    timestamp: Date.now(),
                    message: error.message,
                    rejectCode: error.code,
                    payload: undefined,
                };
            }

            console.error(error);

            return {
                type: EVENT_SUBJECT.DELETE_ALL_OPEN_ORDER,
                success: false,
                userId: payload.userId,
                eventId: this.getUpdatedEventId(),
                timestamp: Date.now(),
                message: "Unexpected internal error",
                rejectCode: EVENT_REJECT_CODES.INTERNAL_ERROR,
                payload: undefined,
            };

        }
    }

    private getUserPosition = (payload: GetUserOpenPositionRequestPayload): GetUserOpenPositionEngineResponse => {
        try {

            const position = this.positionEngine.getuserPosition(payload);

            return {
                type: EVENT_SUBJECT.GET_USER_OPEN_POSITION,
                success: true,
                userId: payload.userId,
                eventId: this.getUpdatedEventId(),
                timestamp: Date.now(),
                message: "Position fetched successfully",
                payload: { position },
            };

        } catch (error) {

            if (error instanceof RejectError) {
                return {
                    type: EVENT_SUBJECT.GET_USER_OPEN_POSITION,
                    success: false,
                    userId: payload.userId,
                    eventId: this.getUpdatedEventId(),
                    timestamp: Date.now(),
                    message: error.message,
                    rejectCode: error.code,
                    payload: undefined,
                };
            }

            console.error(error);

            return {
                type: EVENT_SUBJECT.GET_USER_OPEN_POSITION,
                success: false,
                userId: payload.userId,
                eventId: this.getUpdatedEventId(),
                timestamp: Date.now(),
                message: "Unexpected internal error",
                rejectCode: EVENT_REJECT_CODES.INTERNAL_ERROR,
                payload: undefined,
            };

        }
    }

    private getAllUserPositions = (payload: GetAllUserOpenPositionRequestPayload): GetAllUserOpenPositionEngineResponse => {
        try {

            const positions = this.positionEngine.getAllUserPositions(payload);

            return {
                type: EVENT_SUBJECT.GET_ALL_USER_OPEN_POSITION,
                success: true,
                userId: payload.userId,
                eventId: this.getUpdatedEventId(),
                timestamp: Date.now(),
                message: "Positions fetched successfully",
                payload: { positions },
            };

        } catch (error) {

            if (error instanceof RejectError) {
                return {
                    type: EVENT_SUBJECT.GET_ALL_USER_OPEN_POSITION,
                    success: false,
                    userId: payload.userId,
                    eventId: this.getUpdatedEventId(),
                    timestamp: Date.now(),
                    message: error.message,
                    rejectCode: error.code,
                    payload: undefined,
                };
            }

            console.error(error);

            return {
                type: EVENT_SUBJECT.GET_ALL_USER_OPEN_POSITION,
                success: false,
                userId: payload.userId,
                eventId: this.getUpdatedEventId(),
                timestamp: Date.now(),
                message: "Unexpected internal error",
                rejectCode: EVENT_REJECT_CODES.INTERNAL_ERROR,
                payload: undefined,
            };

        }
    }

    private getMarketDepth = (payload: GetMarketDepthRequestPayload): GetMarketDepthOrderEngineResponse => {
        try {

            const { market, depths } = this.matchingEngine.getMarketDepth(payload);

            return {
                type: EVENT_SUBJECT.GET_MARKET_DEPTH,
                success: true,
                eventId: this.getUpdatedEventId(),
                timestamp: Date.now(),
                message: "Order cancelled successfully",
                payload: { market, depths },
            };

        } catch (error) {

            if (error instanceof RejectError) {
                return {
                    type: EVENT_SUBJECT.GET_MARKET_DEPTH,
                    success: false,
                    eventId: this.getUpdatedEventId(),
                    timestamp: Date.now(),
                    message: error.message,
                    rejectCode: error.code,
                    payload: undefined,
                };
            }

            console.error(error);

            return {
                type: EVENT_SUBJECT.GET_MARKET_DEPTH,
                success: false,
                eventId: this.getUpdatedEventId(),
                timestamp: Date.now(),
                message: "Unexpected internal error",
                rejectCode: EVENT_REJECT_CODES.INTERNAL_ERROR,
                payload: undefined,
            };

        }
    }

    private getOneTicker = (payload: GetOneTickerEventPayload): GetOneTickerEngineResponse => {
        try {
            if (!this.state.markets.has(payload.symbol)) {
                throw new RejectError(EVENT_REJECT_CODES.MARKET_NOT_FOUND, "Market not found");
            }

            const ticker = this.state.dailyTickers.get(payload.symbol) ?? null;

            return {
                type: EVENT_SUBJECT.GET_ONE_TICKER,
                success: true,
                eventId: this.getUpdatedEventId(),
                timestamp: Date.now(),
                message: "Ticker fetched successfully",
                payload: { ticker },
            };

        } catch (error) {

            if (error instanceof RejectError) {
                return {
                    type: EVENT_SUBJECT.GET_ONE_TICKER,
                    success: false,
                    eventId: this.getUpdatedEventId(),
                    timestamp: Date.now(),
                    message: error.message,
                    rejectCode: error.code,
                };
            }

            console.error(error);

            return {
                type: EVENT_SUBJECT.GET_ONE_TICKER,
                success: false,
                eventId: this.getUpdatedEventId(),
                timestamp: Date.now(),
                message: "Unexpected internal error",
                rejectCode: EVENT_REJECT_CODES.INTERNAL_ERROR,
            };
        }
    }

    private getAllTicker = (_payload: GetAllTickerEventPayload): GetAllTickerEngineResponse => {
        try {
            const tickers = Object.fromEntries(this.state.dailyTickers);

            return {
                type: EVENT_SUBJECT.GET_ALL_TICKER,
                success: true,
                eventId: this.getUpdatedEventId(),
                timestamp: Date.now(),
                message: "Tickers fetched successfully",
                payload: { tickers },
            };

        } catch (error) {

            console.error(error);

            return {
                type: EVENT_SUBJECT.GET_ALL_TICKER,
                success: false,
                eventId: this.getUpdatedEventId(),
                timestamp: Date.now(),
                message: "Unexpected internal error",
                rejectCode: EVENT_REJECT_CODES.INTERNAL_ERROR,
            };
        }
    }

    private healtCheck = (payload: EngineHealthCheckRequestPayload): HealthCheckEngineResponse => {
        return {
            type: EVENT_SUBJECT.HEALTH_CHECK,
            success: true,
            message: "Trade engine is up and running",
            eventId: this.getUpdatedEventId(),
            timestamp: Date.now(),
            payload: { healthy: true, message: payload.message }
        };
    }

    private indexPriceUpdate = (payload: IndexPriceUpdateEventPayload): IndexPriceUpdateEngineResponse => {
        try {

            const liquidablePositions = this.positionEngine.getLiquidPositions(payload);
            const liquidationResult = this.executeLiquidation(liquidablePositions, Number(payload.indexPrice), payload.timestamp);

            return {
                type: EVENT_SUBJECT.INDEX_PRICE_UPDATE_EVENT,
                success: true,
                eventId: this.getUpdatedEventId(),
                timestamp: Date.now(),
                message: "Index Price Updated and Liquidation Triggered successfully",
                payload: liquidationResult,
            };

        } catch (error) {

            if (error instanceof RejectError) {
                return {
                    type: EVENT_SUBJECT.INDEX_PRICE_UPDATE_EVENT,
                    success: false,
                    eventId: this.getUpdatedEventId(),
                    timestamp: Date.now(),
                    message: error.message,
                    rejectCode: error.code,
                };
            }

            console.error(error);

            return {
                type: EVENT_SUBJECT.INDEX_PRICE_UPDATE_EVENT,
                success: false,
                eventId: this.getUpdatedEventId(),
                timestamp: Date.now(),
                message: "Unexpected internal error",
                rejectCode: EVENT_REJECT_CODES.INTERNAL_ERROR,
            };
        }
    }

    private executeLiquidation = (positions: UserPositionType[], indexPrice: number, timestamp: number) => {
        const positionIds = positions.map((position) => position.positionId);
        let attempts = 0;
        let failures = 0;

        for (const position of positions) {
            attempts++;
            const oppositeSide = position.position === OrderPosition.LONG ? OrderSide.SELL : OrderSide.BUY;
            const market = this.state.markets.get(position.symbol);

            if (!market) {
                failures++;
                continue;
            }

            const result = this.createOrder({
                userId: position.userId,
                symbol: market.symbol,
                marketType: MarketType.PERP,
                side: oppositeSide,
                type: OrderType.MARKET,
                entryPrice: String(indexPrice),
                quantity: String(position.quantity),
                leverage: Math.max(1, Math.ceil(position.leverage)),
                reduceOnly: true,
                liquidation: true,
                postOnly: false,
                stpMode: STPMode.CANCEL_TAKER,
                timeInForce: TimeInForce.IOC,
                createdAt: timestamp,
            });

            if (!result.success) {
                failures++;
                continue;
            }

            if (result.payload) {
                const unfilled = Number(result.payload.remainingQuantity);
                if (unfilled > 0) {
                    this.positionEngine.triggerADL(
                        market.symbol,
                        position.userId,
                        position.position,
                        unfilled,
                        position.bankruptcyPrice,
                        this.getUpdatedEventId(),
                    );
                }
            }
        }

        return { positionIds, failures, attempts }
    }

    private processFundingSettlment = (payload: FundingUpdateEventPayload): FundingUpdateEngineResponse => {
        try {
            const updates = this.positionEngine.onFundingSettlement(payload);
            this.executeLiquidation(updates.liquidatablePositions, updates.indexPrice, Date.now());

            return {
                type: EVENT_SUBJECT.FUNDING_RATE_UPDATE_EVENT,
                success: true,
                eventId: this.getUpdatedEventId(),
                timestamp: Date.now(),
                message: "Index Price Updated and Liquidation Triggered successfully",
                payload: {
                    symbol: updates.symbol,
                    fundingRateBps: updates.fundingRateBps,
                    payments: updates.payments,
                    insuranceUsed: updates.usedInsuranceFund,
                }
            };

        } catch (error) {

            if (error instanceof RejectError) {
                return {
                    type: EVENT_SUBJECT.FUNDING_RATE_UPDATE_EVENT,
                    success: false,
                    eventId: this.getUpdatedEventId(),
                    timestamp: Date.now(),
                    message: error.message,
                    rejectCode: error.code,
                };
            }

            console.error(error);

            return {
                type: EVENT_SUBJECT.FUNDING_RATE_UPDATE_EVENT,
                success: false,
                eventId: this.getUpdatedEventId(),
                timestamp: Date.now(),
                message: "Unexpected internal error",
                rejectCode: EVENT_REJECT_CODES.INTERNAL_ERROR,
            };
        }
    }

    private getOneMarketRisk = (payload: GetOneMarketRiskEventPayload): GetOneMarketRiskEngineResponse => {
        try {
            const marketRisk = this.state.marketRisk.get(payload.symbol);

            if (!marketRisk) {
                throw new RejectError(EVENT_REJECT_CODES.MARKET_NOT_FOUND, "No market risk data found for the symbol");
            }


            return {
                type: EVENT_SUBJECT.GET_ONE_MARKET_RISK,
                success: true,
                eventId: this.getUpdatedEventId(),
                timestamp: Date.now(),
                message: "Index Price Updated and Liquidation Triggered successfully",
                payload: { risk: marketRisk }
            };

        } catch (error) {

            if (error instanceof RejectError) {
                return {
                    type: EVENT_SUBJECT.GET_ONE_MARKET_RISK,
                    success: false,
                    eventId: this.getUpdatedEventId(),
                    timestamp: Date.now(),
                    message: error.message,
                    rejectCode: error.code,
                };
            }

            console.error(error);

            return {
                type: EVENT_SUBJECT.GET_ONE_MARKET_RISK,
                success: false,
                eventId: this.getUpdatedEventId(),
                timestamp: Date.now(),
                message: "Unexpected internal error",
                rejectCode: EVENT_REJECT_CODES.INTERNAL_ERROR,
            };
        }
    }

    private getAllMarketRisk = (_payload: GetAllMarketRiskEventPayload): GetAllMarketRiskEngineResponse => {
        try {
            const marketRisk = Object.fromEntries(this.state.marketRisk);

            if (!marketRisk) {
                throw new RejectError(EVENT_REJECT_CODES.MARKET_NOT_FOUND, "No market risk data found for the symbol");
            }

            return {
                type: EVENT_SUBJECT.GET_ALL_MARKET_RISK,
                success: true,
                eventId: this.getUpdatedEventId(),
                timestamp: Date.now(),
                message: "Index Price Updated and Liquidation Triggered successfully",
                payload: { risk: marketRisk }
            };

        } catch (error) {

            if (error instanceof RejectError) {
                return {
                    type: EVENT_SUBJECT.GET_ALL_MARKET_RISK,
                    success: false,
                    eventId: this.getUpdatedEventId(),
                    timestamp: Date.now(),
                    message: error.message,
                    rejectCode: error.code,
                };
            }

            console.error(error);

            return {
                type: EVENT_SUBJECT.GET_ALL_MARKET_RISK,
                success: false,
                eventId: this.getUpdatedEventId(),
                timestamp: Date.now(),
                message: "Unexpected internal error",
                rejectCode: EVENT_REJECT_CODES.INTERNAL_ERROR,
            };
        }
    }

    private getOneMarketOpenInterest(payload: GetOneMarketOpenInterestEventPayload): GetOneMarketOpenInterestEngineResponse {
        try {
            const marketData = this.matchingEngine.getOpenInterest(payload.symbol);

            return {
                type: EVENT_SUBJECT.GET_ONE_OPEN_INTEREST,
                success: true,
                eventId: this.getUpdatedEventId(),
                timestamp: Date.now(),
                message: "Index Price Updated and Liquidation Triggered successfully",
                payload: {
                    openInterest: {
                        volume: String(marketData.volume),
                        quantity: String(marketData.quantity),
                        lastPrice: String(marketData.lastPrice),
                        symbol: payload.symbol,
                    }
                }
            };

        } catch (error) {

            if (error instanceof RejectError) {
                return {
                    type: EVENT_SUBJECT.GET_ONE_OPEN_INTEREST,
                    success: false,
                    eventId: this.getUpdatedEventId(),
                    timestamp: Date.now(),
                    message: error.message,
                    rejectCode: error.code,
                };
            }

            console.error(error);

            return {
                type: EVENT_SUBJECT.GET_ONE_OPEN_INTEREST,
                success: false,
                eventId: this.getUpdatedEventId(),
                timestamp: Date.now(),
                message: "Unexpected internal error",
                rejectCode: EVENT_REJECT_CODES.INTERNAL_ERROR,
            };
        }
    }

    private getAllMarketOpenInterest(_payload: GetAllMarketOpenInterestEventPayload): GetAllMarketOpenInterestEngineResponse {
        try {
            const marketData = this.matchingEngine.getAllOpenInterest();
            const parsedData = marketData.map(data => ({
                volume: String(data.marketData.volume),
                quantity: String(data.marketData.quantity),
                lastPrice: String(data.marketData.lastPrice),
                symbol: data.symbol
            }))

            return {
                type: EVENT_SUBJECT.GET_ALL_OPEN_INTEREST,
                success: true,
                eventId: this.getUpdatedEventId(),
                timestamp: Date.now(),
                message: "Index Price Updated and Liquidation Triggered successfully",
                payload: { openInterest: parsedData }
            };


        } catch (error) {

            if (error instanceof RejectError) {
                return {
                    type: EVENT_SUBJECT.GET_ALL_OPEN_INTEREST,
                    success: false,
                    eventId: this.getUpdatedEventId(),
                    timestamp: Date.now(),
                    message: error.message,
                    rejectCode: error.code,
                };
            }

            console.error(error);

            return {
                type: EVENT_SUBJECT.GET_ALL_OPEN_INTEREST,
                success: false,
                eventId: this.getUpdatedEventId(),
                timestamp: Date.now(),
                message: "Unexpected internal error",
                rejectCode: EVENT_REJECT_CODES.INTERNAL_ERROR,
            };
        }
    }

    private applySnapshot(snapshot: EngineSnapshot) {
        this.eventSequenceId = snapshot.eventSequenceId;

        for (const asset of snapshot.assets) {
            this.state.assets.set(asset.symbol, asset);
        }

        for (const [userId, balances] of snapshot.balances) {
            this.state.balances.set(userId, new Map(balances));
        }

        for (const [symbol, risk] of snapshot.marketRisk) {
            this.state.marketRisk.set(symbol, risk);
        }

        this.state.fundingPayments.push(...snapshot.fundingPayments);

        for (const [symbol, amount] of snapshot.insuranceFunds) {
            this.state.insuranceFunds.set(symbol, amount);
        }

        for (const [symbol, amount] of snapshot.commissionFunds) {
            this.state.commissionFunds.set(symbol, amount);
        }

        for (const [symbol, ticker] of snapshot.dailyTickers ?? []) {
            this.state.dailyTickers.set(symbol, ticker);
        }

        for (const market of snapshot.markets) {
            const marketSnapshot = snapshot.marketSnapshots.find((m) => m.symbol === market.symbol);
            this.marketEngine.restoreMarket(market, marketSnapshot);
        }
    }

    private createR2Config(): R2Config {

        if (process.env.R2_ACCOUNT_ID === undefined) {
            throw new Error("R2 Account ID not found");
        }

        if (process.env.R2_ACCESS_KEY_ID === undefined) {
            throw new Error("R2 Access key ID not found");
        }

        if (process.env.R2_SECRET_ACCESS_KEY === undefined) {
            throw new Error("R2 secret Access key ID not found");
        }

        if (process.env.R2_BUCKET_NAME === undefined) {
            throw new Error("R2 bucket name not found");
        }

        if (process.env.R2_BUCKET_ENDPOINT === undefined) {
            throw new Error("R2 bucket endpoint not found");
        }

        const config: R2Config = {
            accountId: process.env.R2_ACCOUNT_ID,
            accessKeyId: process.env.R2_ACCESS_KEY_ID,
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
            bucketName: process.env.R2_BUCKET_NAME,
            endpoint: process.env.R2_BUCKET_ENDPOINT,
        }

        return config;
    }

    private internalError(message: string, rejectCode?: EVENT_REJECT_CODES, type?: EVENT_SUBJECT): DefaultEngineResponse {

        return {
            success: false,
            eventId: this.getUpdatedEventId(),
            timestamp: Date.now(),
            message,
            rejectCode,
            type
        };
    }

    getUpdatedEventId(): number {
        return (++this.eventSequenceId);
    }
}
