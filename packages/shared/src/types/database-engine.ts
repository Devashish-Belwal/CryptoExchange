import { BalanceUpdateType } from "./balance";
import { DepthUpdate, FillType } from "./depth";
import { AssetType, FundingPayment } from "./market"
import { CreateOrderReturnType, MarketType } from "./order";
import { ClosedPositionUpdate, UserPositionType } from "./position";

export type AssetUpdate = {
    symbol: string;
    name?: string;
    type?: AssetType;
    logoUrl?: string;
    isActive?: boolean;
    precision?: number;
}

export type MarketUpdate = {
    symbol: string;
    name?: string;
    marketType?: MarketType;
    baseAssetSymbol?: string;
    quoteAssetSymbol?: string;
    maxLeverage?: number;
    minQty?: string;
    tickSize?: string;
    lotSize?: string;
    minNotional?: number;
    isActive?: boolean;
}

export type UserUpdate = {
    userId: string;
    username: string;
    email: string;
    passwordHash: string;
}

export type CommissionUpdate = {
    symbol: string;
    commissionFund: number;
    insuranceFund: number;
}

export type BaseUpdate = {
    asset?: AssetUpdate;
    market?: MarketUpdate;
    user?: UserUpdate;
    orders?: CreateOrderReturnType[];
    depths?: DepthUpdate[];
    tickers?: TickerUpdate[];
    markPrices?: MarkPriceUpdate[];
    balances?: BalanceUpdateType[];
    trades?: FillType[];
    positions?: UserPositionType[];
    closedPositions?: ClosedPositionUpdate[];
    commissions?: CommissionUpdate[];
}

// Day-based rolling ticker: accumulates from the first trade of the current
// UTC day up to the latest trade, held in EngineState.dailyTickers and reset
// when a trade's timestamp falls on a later UTC day than periodStart.
export type TickerUpdate = {
    symbol: string;
    openPrice: string;
    high: string;
    low: string;
    lastPrice: string;
    priceChange: string;
    priceChangePercentage: string;
    volume: string;
    trades: number;
    periodStart: number;
    timestamp: number;
};

export type MarkPriceUpdate = {
    symbol: string;
    markPrice: string;
    indexPrice?: string;
    fundingRateBps?: string;
    timestamp: number;
};

