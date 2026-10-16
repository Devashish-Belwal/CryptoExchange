import { BalanceLedger, BalanceReturnType } from "./balance";
import { BaseUpdate, TickerUpdate } from "./database-engine";
import { FillType, orderDepthChange } from "./depth";
import { EVENT_REJECT_CODES } from "./engine";
import { Asset, Market, MarketRiskState, MarketRiskStates } from "./market";
import { CreateOrderReturnType, MarketType, OrderSide, OrderStatus, OrderType, STPMode, TimeInForce } from "./order";
import { UserPositionType } from "./position";

export type BaseResponseType = {
    success: boolean;
    message: string;
    userId?: string;
    eventId: number;
    timestamp: number;
    rejectCode?: EVENT_REJECT_CODES;
    updates?: BaseUpdate;
}

//  ---------------------------

// ADD ASSET
export type AddAssetResponsePayload = Asset;

// UPDATE ASSET
export type UpdateAssetResponsePayload = Asset;

// DELETE ASSET
export type DeleteAssetResponsePayload = Asset;

// GET ALL ASSETS
export type GetAllAssetResponsePayload = {
    assets: Record<string, Asset>
}

//  ---------------------------

// ADD MARKET
export type AddMarketResponsePayload = Market

// UPDATE MARKET
export type UpdateMarketResponsePayload = Market

// DELETE MARKET
export type DeleteMarketResponsePayload = Market

// GET ONE MARKET
export type GetOneMarketResponsePayload = Market

// GET ALL MARKET
export type GetAllMarketResponsePayload = {
    markets: Record<string, Market>
}

//  ---------------------------

// GET ONE MARKET TICKER
export type GetOneTickerResponsePayload = {
    ticker: TickerUpdate | null;
}

// GET ALL MARKET TICKERS
export type GetAllTickersResponsePayload = {
    tickers: Record<string, TickerUpdate>;
}

//  ---------------------------

// ADD USER
export type AddUserResponsePayload = {
    userId: string;
    username: string,
    email: string;
};

// GET BALANCE
export type GetUserBalancesResponsePayload = {
    balances: BalanceReturnType;
};

// ON RAMP BALANCE
export type OnRampBalanceResponsePayload = {
    symbol: string;
    total: number;
    locked: number;
};

// OFF RAMP BALANCE
export type OffRampBalanceResponsePayload = {
    symbol: string;
    amount: string;
    total: number;
    locked: number;
};

//  ---------------------------

// ORDER CREATE
export type CreateOrderResponsePayload = {
    symbol: string;
    userId: string;
    entryPrice: string;
    quantity: string;
    side: OrderSide;
    type: OrderType;
    postOnly: boolean;
    stpMode: STPMode;
    marketType: MarketType;
    timeInForce: TimeInForce;
    createdAt: number;
    orderId: string;
    remainingQuantity: string;
    filledQuantity: string;
    averagePrice: string;
    balance: BalanceLedger;
    status: OrderStatus;
    depth: orderDepthChange;
    fills: FillType[];
    leverage?: number;
    margin?: string;
    reduceOnly?: boolean;
};

// ORDER CANCELLED
export type CancelOrderResponsePayload = {
    orderId: string;
};

// GET ONE OPEN ORDER
export type GetOneOpenOrderResponsePayload = {
    order: CreateOrderReturnType
};

// GET ALL OPEN ORDERS
export type GetAllOpenOrderResponsePayload = {
    orders: CreateOrderReturnType[]
};

// DELETE ALL OPEN ORDERS
export type DeleteAllOpenOrderResponsePayload = {
    orderId: string[],
    market: Market
};

//  ---------------------------

// GET USER OPEN POSITION
export type GetUserOpenPositionResponsePayload = {
    position: UserPositionType
};

// GET ALL USER OPEN POSITIONS
export type GetAllUserOpenPositionResponsePayload = {
    positions: UserPositionType[]
};


//  ---------------------------

// GET ONE MARKET DEPTH
export type GetMarketDepthResponsePayload = {
    depths: orderDepthChange,
    market: Market

};

//  ---------------------------

// GET ONE MARKET MARKPRICE
export type GetOneMarketRiskResponsePayload = {
    risk: MarketRiskState
};

// GET ALL MARKET MARKPRICE
export type GetAllMarketRiskResponsePayload = {
    risk: Record<string, MarketRiskState>
};

//  ---------------------------

// GET ONE MARKET OPEN INTEREST
export type GetOneMarketOpenInterestResponsePayload = {
    openInterest: {
        volume: string;
        quantity: string;
        lastPrice: string;
        symbol: string;
    }
};

// GET ALL MARKET OPEN INTEREST
export type GetAllMarketOpenInterestResponsePayload = {
    openInterest: {
        volume: string;
        quantity: string;
        lastPrice: string;
        symbol: string;
    }[]
};

// ENGINE HEALTH REQUEST
export type EngineHealthCheckResponsePayload = {
    healthy: boolean;
    message: string;
};

//  ---------------------------

// INDEX PRICE UPDATE EVENT (LIQUIDATION SUMMARY)
export type LiquidationResponsePayload = {
    positionIds: string[];
    attempts: number;
    failures: number;
};

// FUNDING RATE UPDATE EVENT
export type FundingSettlementResponsePayload = {
    symbol: string;
    fundingRateBps: number;
    payments: number;
    insuranceUsed: number;
};

