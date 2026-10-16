import { AssetType } from "./market";
import { MarketType, OrderSide, OrderType, STPMode, TimeInForce } from "./order";

// ADD ASSET
export type AddAssetRequestPayload = {
    userId: string;
    symbol: string;
    name: string;
    type: AssetType;
    logoUrl?: string;
    isActive: boolean;
    precision: number;
}

// UPDATE ASSET
export type UpdateAssetRequestPayload = {
    userId: string;
    symbol: string;
    name?: string;
    precision?: number;
    logoUrl?: string;
}

// DELETE ASSET
export type DeleteAssetRequestPayload = {
    userId: string;
    symbol: string;
}

// GET ALL ASSETS
export type GetAllAssetRequestPayload = {}

// ADD MARKET
export type AddMarketRequestPayload = {
    userId: string;
    symbol: string;
    name: string;
    marketType: MarketType;
    baseAssetSymbol: string;
    quoteAssetSymbol: string;
    maxLeverage: number;
    minQty: string;
    tickSize: string;
    lotSize: string;
    minNotional: number;
    isActive: boolean;
}

// UPDATE MARKET
export type UpdateMarketRequestPayload = {
    userId: string;
    symbol: string;
    name?: string;
    marketType?: MarketType;
    baseAssetSymbol?: string;
    quoteAssetSymbol?: string;
    maxLeverage?: number;
    minNotional?: number;
    minQty?: string;
    tickSize?: string;
    lotSize?: string;
    isActive?: boolean;
}

// DELETE MARKET
export type DeleteMarketRequestPayload = {
    userId: string;
    symbol: string;
}

// GET ONE MARKET
export type GetOneMarketRequestPayload = {
    symbol: string;
}

// GET ALL MARKET
export type GetAllMarketRequestPayload = {}

// ADD USER
export type UserAddRequestPayload = {
    userId: string;
    username: string;
    email: string;
    passwordHash: string;
}

// GET BALANCE
export type GetUserBalancesRequestPayload = {
    userId: string;
}

// ON RAMP BALANCE
export type OnRampBalanceRequestPayload = {
    userId: string,
    symbol: string;
    amount: string;
}

// OFF RAMP BALANCE
export type OffRampBalanceRequestPayload = {
    userId: string,
    symbol: string;
    amount: string;
}

// ORDER CREATE
export type CreateOrderRequestPayload = {
    entryPrice: string;
    quantity: string;
    userId: string;
    symbol: string;
    side: OrderSide;
    type: OrderType;
    postOnly: boolean;
    stpMode: STPMode;
    timeInForce: TimeInForce;
    createdAt: number;
    marketType: MarketType;
    leverage?: number;
    liquidation?: boolean;
    reduceOnly?: boolean;
};

// ORDER CANCELLED
export type CancelOrderRequestPayload = {
    orderId: string;
    userId: string;
    symbol: string;
};

// GET ONE OPEN ORDER
export type GetOneOpenOrderRequestPayload = {
    orderId: string;
    userId: string;
    symbol: string;
};

// GET ALL OPEN ORDERS
export type GetAllOpenOrderRequestPayload = {
    userId: string;
    symbol: string;
};

// DELETE ALL OPEN ORDERS
export type DeleteAllOpenOrderRequestPayload = {
    userId: string;
    symbol: string;
};

// GET USER OPEN POSITION
export type GetUserOpenPositionRequestPayload = {
    userId: string;
    symbol: string;
};

// GET ALL USER OPEN POSITIONS
export type GetAllUserOpenPositionRequestPayload = {
    userId: string;
};

// GET ONE MARKET DEPTH
export type GetMarketDepthRequestPayload = {
    symbol: string;
    limit?: number;
};

// INDEX PRICE UPDATE EVENT
export type IndexPriceUpdateEventPayload = {
    symbol: string;
    indexPrice: string;
    timestamp: number;
}

// FUNDING RATE UPDATE EVENT
export type FundingUpdateEventPayload = {
    symbol: string;
    intervalSeconds: number,
}

// ORDER LIQUIDATION EVENT

// GET ONE MARKET RISK
export type GetOneMarketRiskEventPayload = {
    symbol: string;
}

// GET ALL MARKET RISK
export type GetAllMarketRiskEventPayload = {}

// GET ONE TICKER
export type GetOneTickerEventPayload = {
    symbol: string;
}

// GET ALL TICKERS
export type GetAllTickerEventPayload = {}

// GET ONE MARKET OPEN INTEREST

export type GetOneMarketOpenInterestEventPayload = {
    symbol: string;
}

// GET ALL MARKET OPEN INTEREST

export type GetAllMarketOpenInterestEventPayload = {}

// HEALTH CHECK
export type EngineHealthCheckRequestPayload = {
    message: string
}







