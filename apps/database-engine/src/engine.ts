import { prisma } from "@workspace/database";
import { AnyTradeResult, AssetUpdate, BalanceUpdateType, ClosedPositionUpdate, CommissionUpdate, CreateOrderReturnType, FillType, MarketUpdate, TimeInForce, UserUpdate } from "@workspace/shared";

const TIME_IN_FORCE_TO_DB: Record<TimeInForce, "GTC" | "IOC" | "FOK"> = {
    [TimeInForce.GTC]: "GTC",
    [TimeInForce.IOC]: "IOC",
    [TimeInForce.FOK]: "FOK",
};

export class Database {

    process = async (event: AnyTradeResult) => {

        if (!event.type) return;

        const updates = event.updates;

        if (!updates) return;

        try {

            await Promise.all([
                this.applyAssets(event.eventId, updates.asset),
                this.applyMarkets(event.eventId, updates.market),
                this.applyUser(event.eventId, updates.user),
            ]);

            await this.applyOrders(event.eventId, updates.orders);

            await Promise.all([
                this.applyBalances(event.eventId, updates.balances),
                this.applyTrades(updates.trades),
                this.applyCommissions(event.eventId, updates.commissions),
                this.applyClosedPositions(event.eventId, updates.closedPositions),
            ])

        } catch (error) {
            console.error(error);
        }
    }

    async applyAssets(eventId: number, asset?: AssetUpdate) {
        if (!asset) return;

        const { count } = await prisma.asset.updateMany({
            where: { symbol: asset.symbol, eventSequenceId: { lte: eventId } },
            data: {
                name: asset.name,
                type: asset.type,
                precision: asset.precision,
                logoUrl: asset.logoUrl,
                isActive: asset.isActive,
                eventSequenceId: eventId,
            },
        });

        if (count === 0) {
            await prisma.asset.upsert({
                where: { symbol: asset.symbol },
                update: {},
                create: {
                    symbol: asset.symbol,
                    name: asset.name!,
                    type: asset.type!,
                    precision: asset.precision!,
                    logoUrl: asset.logoUrl,
                    isActive: asset.isActive ?? true,
                    eventSequenceId: eventId,
                },
            });
        }
    }

    async applyMarkets(eventId: number, market?: MarketUpdate) {
        if (!market) return;

        const { count } = await prisma.market.updateMany({
            where: { symbol: market.symbol, eventSequenceId: { lte: eventId } },
            data: {
                name: market.name,
                marketType: market.marketType,
                maxLeverage: market.maxLeverage,
                tickSize: market.tickSize,
                lotSize: market.lotSize,
                minOrderSize: market.minQty,
                baseAssetId: market.baseAssetSymbol,
                quoteAssetId: market.quoteAssetSymbol,
                isActive: market.isActive,
                minNotional: market.minNotional !== undefined ? String(market.minNotional) : undefined,
                eventSequenceId: eventId,
            },
        });

        if (count === 0) {
            await prisma.market.upsert({
                where: { symbol: market.symbol },
                update: {},
                create: {
                    symbol: market.symbol,
                    name: market.name!,
                    marketType: market.marketType!,
                    maxLeverage: market.maxLeverage,
                    tickSize: market.tickSize!,
                    lotSize: market.lotSize!,
                    minOrderSize: market.minQty!,
                    baseAssetId: market.baseAssetSymbol!,
                    quoteAssetId: market.quoteAssetSymbol!,
                    isActive: market.isActive ?? true,
                    minNotional: String(market.minNotional),
                    eventSequenceId: eventId,
                },
            });
        }
    }

    async applyUser(eventId: number, user?: UserUpdate) {
        if (!user) return;

        const { count } = await prisma.user.updateMany({
            where: { id: user.userId, eventSequenceId: { lte: eventId } },
            data: {
                username: user.username,
                email: user.email,
                passwordHash: user.passwordHash,
                eventSequenceId: eventId,
            },
        });

        if (count === 0) {
            await prisma.user.upsert({
                where: { id: user.userId },
                update: {},
                create: {
                    id: user.userId,
                    username: user.username,
                    email: user.email,
                    passwordHash: user.passwordHash,
                    eventSequenceId: eventId,
                },
            });
        }
    }

    async applyBalances(eventId: number, balances?: BalanceUpdateType[]) {
        if (!balances || balances.length === 0) return;

        for (const balance of balances) {
            const { count } = await prisma.balance.updateMany({
                where: { userId: balance.userId, symbol: balance.symbol, eventSequenceId: { lte: eventId } },
                data: {
                    total: String(balance.total),
                    locked: String(balance.locked),
                    eventSequenceId: eventId,
                },
            });

            if (count === 0) {
                await prisma.balance.upsert({
                    where: {
                        userId_symbol: {
                            userId: balance.userId,
                            symbol: balance.symbol
                        },
                    },
                    update: {},
                    create: {
                        userId: balance.userId,
                        symbol: balance.symbol,
                        total: String(balance.total),
                        locked: String(balance.locked),
                        eventSequenceId: eventId,
                    }
                });
            }

            for (const transaction of balance.transactions) {
                await prisma.balanceTransaction.create({
                    data: {
                        userId: transaction.userId,
                        symbol: transaction.symbol,
                        side: transaction.side,
                        type: transaction.type,
                        amount: transaction.amount,
                        marketSymbol: transaction.marketSymbol,
                        orderId: transaction.orderId,
                        tradeId: transaction.tradeId,
                    }
                });
            }
        }
    }

    async applyOrders(eventId: number, orders?: CreateOrderReturnType[]) {
        if (!orders || orders.length === 0) return;

        for (const order of orders) {
            const { count } = await prisma.order.updateMany({
                where: { orderId: order.orderId, eventSequenceId: { lte: eventId } },
                data: {
                    status: order.status,
                    remainingQuantity: order.remainingQuantity,
                    filledQuantity: order.filledQuantity,
                    averagePrice: order.averagePrice,
                    margin: order.margin,
                    eventSequenceId: eventId,
                },
            });

            if (count === 0) {
                await prisma.order.upsert({
                    where: { orderId: order.orderId },
                    update: {},
                    create: {
                        orderId: order.orderId,
                        userId: order.userId,
                        symbol: order.symbol,
                        marketType: order.marketType,
                        side: order.side,
                        type: order.type,
                        status: order.status,
                        timeInForce: TIME_IN_FORCE_TO_DB[order.timeInForce],
                        stpMode: order.stpMode,
                        postOnly: order.postOnly,
                        reduceOnly: order.reduceOnly ?? false,
                        entryPrice: order.entryPrice,
                        quantity: order.quantity,
                        remainingQuantity: order.remainingQuantity,
                        filledQuantity: order.filledQuantity,
                        averagePrice: order.averagePrice,
                        leverage: order.leverage,
                        margin: order.margin,
                        eventSequenceId: eventId,
                    }
                });
            }
        }
    }

    async applyTrades(trades?: FillType[]) {
        if (!trades || trades.length === 0) return;

        for (const trade of trades) {
            await prisma.trade.upsert({
                where: { symbol_tradeId: { symbol: trade.symbol, tradeId: trade.tradeId } },
                update: {},
                create: {
                    tradeId: trade.tradeId,
                    symbol: trade.symbol,
                    price: trade.price,
                    quantity: trade.qty,
                    side: trade.side,
                    status: trade.status,
                    takerOrderId: trade.takerOrderId,
                    takerUserId: trade.takerUserId,
                    takerFee: trade.takerFee,
                    makerOrderId: trade.makerOrderId,
                    makerUserId: trade.makerUserId,
                    makerFee: trade.makerFee,
                }
            });
        }
    }

    async applyClosedPositions(eventId: number, closedPositions?: ClosedPositionUpdate[]) {
        if (!closedPositions || closedPositions.length === 0) return;

        for (const position of closedPositions) {
            const { count } = await prisma.position.updateMany({
                where: { positionId: position.positionId, eventSequenceId: { lte: eventId } },
                data: {
                    exitPrice: String(position.exitPrice),
                    realizedPnl: String(position.realizedPnl),
                    closeReason: position.closeReason,
                    closedAt: new Date(position.closedAt),
                }
            })

            if (count === 0) {
                await prisma.position.upsert({
                    where: { positionId: position.positionId },
                    update: {},
                    create: {
                        positionId: position.positionId,
                        userId: position.userId,
                        symbol: position.symbol,
                        side: position.side,
                        leverage: position.leverage,
                        entryPrice: String(position.entryPrice),
                        exitPrice: String(position.exitPrice),
                        quantity: String(position.quantity),
                        margin: String(position.margin),
                        realizedPnl: String(position.realizedPnl),
                        closeReason: position.closeReason,
                        openedAt: new Date(position.openedAt),
                        closedAt: new Date(position.closedAt),
                        eventSequenceId: eventId
                    }

                })
            }


            if (position.closeReason !== "LIQUIDATED") continue;

            await prisma.liquidation.upsert({
                where: { positionId: position.positionId },
                update: {
                    bankruptcyPrice: String(position.bankruptcyPrice),
                    liquidationPrice: String(position.liquidationPrice),
                    markPrice: String(position.markPrice),
                    deficit: String(position.deficit),
                    insuranceCovered: String(position.insuranceCovered),
                },
                create: {
                    positionId: position.positionId,
                    userId: position.userId,
                    symbol: position.symbol,
                    bankruptcyPrice: String(position.bankruptcyPrice),
                    liquidationPrice: String(position.liquidationPrice),
                    markPrice: String(position.markPrice),
                    deficit: String(position.deficit),
                    insuranceCovered: String(position.insuranceCovered),
                },
            });
        }
    }

    async applyCommissions(eventId: number, commissions?: CommissionUpdate[]) {
        if (!commissions || commissions.length === 0) return;

        for (const commission of commissions) {
            await Promise.all([
                this.applyFund(eventId, commission.symbol, "COMMISSION", String(commission.commissionFund)),
                this.applyFund(eventId, commission.symbol, "INSURANCE", String(commission.insuranceFund)),
            ]);
        }
    }

    private async applyFund(eventId: number, symbol: string, type: "COMMISSION" | "INSURANCE", balance: string) {
        const { count } = await prisma.fund.updateMany({
            where: { symbol, type, eventSequenceId: { lte: eventId } },
            data: { balance, eventSequenceId: eventId },
        });

        if (count === 0) {
            await prisma.fund.upsert({
                where: { symbol_type: { symbol, type } },
                update: {},
                create: { symbol, type, balance, eventSequenceId: eventId },
            });
        }
    }
}

export const DatabaseManager = new Database();
