import { AddAssetResponsePayload, AddMarketResponsePayload, AddUserResponsePayload, BaseResponseType, CancelOrderResponsePayload, CreateOrderResponsePayload, DeleteAllOpenOrderResponsePayload, DeleteAssetResponsePayload, DeleteMarketResponsePayload, EngineHealthCheckResponsePayload, FundingSettlementResponsePayload, GetAllMarketOpenInterestResponsePayload, GetAllMarketRiskResponsePayload, GetAllOpenOrderResponsePayload, GetAllTickersResponsePayload, GetAllUserOpenPositionResponsePayload, GetMarketDepthResponsePayload, GetOneMarketOpenInterestResponsePayload, GetOneMarketRiskResponsePayload, GetOneOpenOrderResponsePayload, GetOneTickerResponsePayload, GetUserBalancesResponsePayload, GetUserOpenPositionResponsePayload, LiquidationResponsePayload, OffRampBalanceResponsePayload, OnRampBalanceResponsePayload, UpdateAssetResponsePayload, UpdateMarketResponsePayload } from "./engine-payload";
import { EVENT_SUBJECT } from "./redis";

export type DefaultEngineResponse = BaseResponseType & {
    type?: EVENT_SUBJECT;
    payload?: never;
};

export type EngineResponseUnion =
    DefaultEngineResponse
    | AddAssetEngineResponse
    | UpdateAssetEngineResponse
    | DeleteAssetEngineResponse
    | AddMarketEngineResponse
    | UpdateMarketEngineResponse
    | DeleteMarketEngineResponse
    | UserAddEngineResponse
    | GetUserBalancesEngineResponse
    | OnRampEngineResponse
    | OffRampEngineResponse
    | CreateOrderEngineResponse
    | CancelOrderEngineResponse
    | GetOneOpenOrderOrderEngineResponse
    | GetAllOpenOrderOrderEngineResponse
    | DeleteAllOpenOrderOrderEngineResponse
    | GetUserOpenPositionEngineResponse
    | GetAllUserOpenPositionEngineResponse
    | GetMarketDepthOrderEngineResponse
    | GetOneTickerEngineResponse
    | GetAllTickerEngineResponse
    | IndexPriceUpdateEngineResponse
    | FundingUpdateEngineResponse
    | GetOneMarketRiskEngineResponse
    | GetAllMarketRiskEngineResponse
    | GetOneMarketOpenInterestEngineResponse
    | GetAllMarketOpenInterestEngineResponse
    | HealthCheckEngineResponse;

export type ResponseMetadata = {
    requestId: string;
    backendId: string;
};

export type AnyTradeResult = ResponseMetadata & EngineResponseUnion;


//  ---------------------------

// ADD ASSET
export type AddAssetEngineResponse = BaseResponseType & {
    type: EVENT_SUBJECT.ADD_ASSET;
    payload?: AddAssetResponsePayload;
}

// UPDATE ASSET
export type UpdateAssetEngineResponse = BaseResponseType & {
    type: EVENT_SUBJECT.UPDATE_ASSET;
    payload?: UpdateAssetResponsePayload;
}

// DELETE ASSET
export type DeleteAssetEngineResponse = BaseResponseType & {
    type: EVENT_SUBJECT.DELETE_ASSET;
    payload?: DeleteAssetResponsePayload;
}

// ADD MARKET
export type AddMarketEngineResponse = BaseResponseType & {
    type: EVENT_SUBJECT.ADD_MARKET;
    payload?: AddMarketResponsePayload;
}

// UPDATE MARKET
export type UpdateMarketEngineResponse = BaseResponseType & {
    type: EVENT_SUBJECT.UPDATE_MARKET;
    payload: UpdateMarketResponsePayload;
}

// DELETE MARKET
export type DeleteMarketEngineResponse = BaseResponseType & {
    type: EVENT_SUBJECT.DELETE_MARKET;
    payload: DeleteMarketResponsePayload;
}

// ADD USER
export type UserAddEngineResponse = BaseResponseType & {
    type: EVENT_SUBJECT.USER_ADD;
    payload: AddUserResponsePayload;
};

// GET BALANCE
export type GetUserBalancesEngineResponse = BaseResponseType & {
    type: EVENT_SUBJECT.GET_BALANCES;
    payload: GetUserBalancesResponsePayload;
};

// ON RAMP BALANCE
export type OnRampEngineResponse = BaseResponseType & {
    type: EVENT_SUBJECT.ON_RAMP;
    payload: OnRampBalanceResponsePayload;
};

// OFF RAMP BALANCE
export type OffRampEngineResponse = BaseResponseType & {
    type: EVENT_SUBJECT.OFF_RAMP;
    payload: OffRampBalanceResponsePayload;
};

// ORDER CREATE
export type CreateOrderEngineResponse = BaseResponseType & {
    type: EVENT_SUBJECT.ORDER_CREATE;
    payload?: CreateOrderResponsePayload;
};

// ORDER CANCELLED
export type CancelOrderEngineResponse = BaseResponseType & {
    type: EVENT_SUBJECT.ORDER_CANCEL;
    payload?: CancelOrderResponsePayload;
};

// GET ONE OPEN ORDER
export type GetOneOpenOrderOrderEngineResponse = BaseResponseType & {
    type: EVENT_SUBJECT.GET_ONE_OPEN_ORDER;
    payload?: GetOneOpenOrderResponsePayload
};

// GET ALL OPEN ORDERS
export type GetAllOpenOrderOrderEngineResponse = BaseResponseType & {
    type: EVENT_SUBJECT.GET_ALL_OPEN_ORDER;
    payload?: GetAllOpenOrderResponsePayload
};

// DELETE ALL OPEN ORDERS
export type DeleteAllOpenOrderOrderEngineResponse = BaseResponseType & {
    type: EVENT_SUBJECT.DELETE_ALL_OPEN_ORDER;
    payload?: DeleteAllOpenOrderResponsePayload;
};

// GET USER OPEN POSITION
export type GetUserOpenPositionEngineResponse = BaseResponseType & {
    type: EVENT_SUBJECT.GET_USER_OPEN_POSITION;
    payload?: GetUserOpenPositionResponsePayload;
};

// GET ALL USER OPEN POSITIONS
export type GetAllUserOpenPositionEngineResponse = BaseResponseType & {
    type: EVENT_SUBJECT.GET_ALL_USER_OPEN_POSITION;
    payload?: GetAllUserOpenPositionResponsePayload;
};

// GET ONE MARKET DEPTH
export type GetMarketDepthOrderEngineResponse = BaseResponseType & {
    type: EVENT_SUBJECT.GET_MARKET_DEPTH;
    payload?: GetMarketDepthResponsePayload
};

// GET ONE TICKER
export type GetOneTickerEngineResponse = BaseResponseType & {
    type: EVENT_SUBJECT.GET_ONE_TICKER;
    payload?: GetOneTickerResponsePayload
};

// GET ALL TICKERS
export type GetAllTickerEngineResponse = BaseResponseType & {
    type: EVENT_SUBJECT.GET_ALL_TICKER;
    payload?: GetAllTickersResponsePayload
};

// INDEX PRICE UPDATE EVENT
export type IndexPriceUpdateEngineResponse = BaseResponseType & {
    type: EVENT_SUBJECT.INDEX_PRICE_UPDATE_EVENT;
    payload?: LiquidationResponsePayload;
}

// FUNDING RATE UPDATE EVENT
export type FundingUpdateEngineResponse = BaseResponseType & {
    type: EVENT_SUBJECT.FUNDING_RATE_UPDATE_EVENT;
    payload?: FundingSettlementResponsePayload;
}

// ORDER LIQUIDATION EVENT

// GET ONE MARKET RISK
export type GetOneMarketRiskEngineResponse = BaseResponseType & {
    type: EVENT_SUBJECT.GET_ONE_MARKET_RISK;
    payload?: GetOneMarketRiskResponsePayload
}

// GET ALL MARKET RISK
export type GetAllMarketRiskEngineResponse = BaseResponseType & {
    type: EVENT_SUBJECT.GET_ALL_MARKET_RISK;
    payload?: GetAllMarketRiskResponsePayload
}

// GET ONE MARKET OPEN INTEREST
export type GetOneMarketOpenInterestEngineResponse = BaseResponseType & {
    type: EVENT_SUBJECT.GET_ONE_OPEN_INTEREST;
    payload?: GetOneMarketOpenInterestResponsePayload
}

// GET ALL MARKET OPEN INTEREST
export type GetAllMarketOpenInterestEngineResponse = BaseResponseType & {
    type: EVENT_SUBJECT.GET_ALL_OPEN_INTEREST;
    payload?: GetAllMarketOpenInterestResponsePayload
}

// ENGINE HEALTH REQUEST
export type HealthCheckEngineResponse = BaseResponseType & {
    type: EVENT_SUBJECT.HEALTH_CHECK;
    payload: EngineHealthCheckResponsePayload;
};


