import { MarketType } from "./order";

export type MarketsType = Map<string, Market>
export type AssetsType = Map<string, Asset>

export type Market = {
    symbol: string;
    name: string;
    marketType: MarketType;
    baseAsset: Asset;
    quoteAsset: Asset;
    maxLeverage: number;
    minQty: number;
    tickSize: number;
    lotSize: number;
    minNotional: number;
}

export type AssetType = "BASE" | "QUOTE"

export type Asset = {
    name: string
    symbol: string;
    type: AssetType;
    precision: number;
    isActive: boolean;
}

export type MarketRiskStates = Map<string, MarketRiskState>;

export type MarketRiskState = {
    indexPrice: number | undefined;
    indexUpdatedAt: number;
    markPrice: number | undefined;
    markUpdatedAt: number;
    lastFundingRateBps: number;
    lastFundingSettledAt: number;
}

export type FundingPayments = FundingPayment[];

export interface FundingPayment {
    symbol: string;
    userId: string;
    positionId: string;
    amount: number;
    fundingRateBps: number;
    timestamp: number;
}

export type MarketFunds = Map<string, number | undefined>;