import { MarketOrderType } from "./order";
import { UserPositionType } from "./position";
import { Asset, Market, MarketRiskState, FundingPayment } from "./market";
import { TickerUpdate } from "./database-engine";

export type R2Config = {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
    endpoint: string;
}

export type OrderbookSnapshot = {
    symbol: string;
    lastTradedPrice: number;
    tradeId: number;
    orders: MarketOrderType[];
}

export type PositionSnapshot = {
    symbol: string;
    positions: UserPositionType[];
}

export type MarketSnapshot = {
    symbol: string;
    takenAt: number;
    orderbook: OrderbookSnapshot;
    positions: PositionSnapshot;
}

export type EngineSnapshot = {
    takenAt: number;
    eventSequenceId: number;
    assets: Asset[];
    markets: Market[];
    balances: [string, [string, { total: number; locked: number }][]][];
    marketRisk: [string, MarketRiskState][];
    fundingPayments: FundingPayment[];
    insuranceFunds: [string, number | undefined][];
    commissionFunds: [string, number | undefined][];
    marketSnapshots: MarketSnapshot[];
    // Optional: absent in snapshots taken before day-based tickers existed.
    dailyTickers?: [string, TickerUpdate][];
}
