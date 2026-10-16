import { AddAssetRequestPayload, AddMarketRequestPayload, CancelOrderRequestPayload, CreateOrderRequestPayload, DeleteAllOpenOrderRequestPayload, DeleteAssetRequestPayload, DeleteMarketRequestPayload, EngineHealthCheckRequestPayload, FundingUpdateEventPayload, GetAllMarketOpenInterestEventPayload, GetAllMarketRiskEventPayload, GetAllOpenOrderRequestPayload, GetAllTickerEventPayload, GetAllUserOpenPositionRequestPayload, GetMarketDepthRequestPayload, GetOneMarketOpenInterestEventPayload, GetOneMarketRiskEventPayload, GetOneOpenOrderRequestPayload, GetOneTickerEventPayload, GetUserOpenPositionRequestPayload, GetUserBalancesRequestPayload, IndexPriceUpdateEventPayload, OffRampBalanceRequestPayload, OnRampBalanceRequestPayload, UpdateAssetRequestPayload, UpdateMarketRequestPayload, UserAddRequestPayload } from "./backend-payload";
import { EVENT_SOURCE, EVENT_SUBJECT } from "./redis";

export type MarketRequestEventType = {
    source: EVENT_SOURCE.BACKEND;
} & EngineRequestUnion;

export type EngineRequestUnion =
    | {
        type: EVENT_SUBJECT.ADD_ASSET;
        payload: AddAssetRequestPayload;
    }
    | {
        type: EVENT_SUBJECT.UPDATE_ASSET;
        payload: UpdateAssetRequestPayload;
    }
    | {
        type: EVENT_SUBJECT.DELETE_ASSET;
        payload: DeleteAssetRequestPayload;
    }
    | {
        type: EVENT_SUBJECT.ADD_MARKET;
        payload: AddMarketRequestPayload;
    }
    | {
        type: EVENT_SUBJECT.UPDATE_MARKET;
        payload: UpdateMarketRequestPayload;
    }
    | {
        type: EVENT_SUBJECT.DELETE_MARKET;
        payload: DeleteMarketRequestPayload;
    }
    | {
        type: EVENT_SUBJECT.USER_ADD;
        payload: UserAddRequestPayload;
    }
    | {
        type: EVENT_SUBJECT.GET_BALANCES;
        payload: GetUserBalancesRequestPayload;
    }
    | {
        type: EVENT_SUBJECT.ON_RAMP;
        payload: OnRampBalanceRequestPayload;
    }
    | {
        type: EVENT_SUBJECT.OFF_RAMP;
        payload: OffRampBalanceRequestPayload;
    }
    | {
        type: EVENT_SUBJECT.ORDER_CREATE;
        payload: CreateOrderRequestPayload;
    }
    | {
        type: EVENT_SUBJECT.ORDER_CANCEL;
        payload: CancelOrderRequestPayload;
    }
    | {
        type: EVENT_SUBJECT.GET_ONE_OPEN_ORDER;
        payload: GetOneOpenOrderRequestPayload;
    }
    | {
        type: EVENT_SUBJECT.GET_ALL_OPEN_ORDER;
        payload: GetAllOpenOrderRequestPayload;
    }
    | {
        type: EVENT_SUBJECT.DELETE_ALL_OPEN_ORDER;
        payload: DeleteAllOpenOrderRequestPayload;
    }
    | {
        type: EVENT_SUBJECT.GET_USER_OPEN_POSITION;
        payload: GetUserOpenPositionRequestPayload;
    }
    | {
        type: EVENT_SUBJECT.GET_ALL_USER_OPEN_POSITION;
        payload: GetAllUserOpenPositionRequestPayload;
    }
    | {
        type: EVENT_SUBJECT.GET_MARKET_DEPTH;
        payload: GetMarketDepthRequestPayload;
    }
    | {
        type: EVENT_SUBJECT.GET_ONE_TICKER;
        payload: GetOneTickerEventPayload;
    }
    | {
        type: EVENT_SUBJECT.GET_ALL_TICKER;
        payload: GetAllTickerEventPayload;
    }
    | {
        type: EVENT_SUBJECT.HEALTH_CHECK;
        payload: EngineHealthCheckRequestPayload;
    }
    | {
        type: EVENT_SUBJECT.INDEX_PRICE_UPDATE_EVENT;
        payload: IndexPriceUpdateEventPayload;
    }
    | {
        type: EVENT_SUBJECT.FUNDING_RATE_UPDATE_EVENT;
        payload: FundingUpdateEventPayload;
    }
    | {
        type: EVENT_SUBJECT.GET_ONE_MARKET_RISK;
        payload: GetOneMarketRiskEventPayload;
    }
    | {
        type: EVENT_SUBJECT.GET_ALL_MARKET_RISK;
        payload: GetAllMarketRiskEventPayload;
    }
    | {
        type: EVENT_SUBJECT.GET_ONE_OPEN_INTEREST;
        payload: GetOneMarketOpenInterestEventPayload;
    }
    | {
        type: EVENT_SUBJECT.GET_ALL_OPEN_INTEREST;
        payload: GetAllMarketOpenInterestEventPayload;
    }
    ;

export type EngineRequestMetadata = {
    requestId: string;
    backendId: string;
    timestamp: number;
    source: EVENT_SOURCE;
};

export type AnyMarketEvent = EngineRequestMetadata & EngineRequestUnion;