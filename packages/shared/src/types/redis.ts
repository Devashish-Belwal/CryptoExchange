
export const REDIS_STREAMS = {
    ENGINE_REQUEST: "engine.request",
    ENGINE_RESPONSE: "engine.response",
}

export const CONSUMER_GROUPS = {
    TRADE_ENGINE: "trade-engine-group",
    DATABASE_ENGINE: "database-engine-group",
    WS_SERVER: "ws-server-group",
}

export interface ConsumeOptions {
    stream: string;
    group: string;
    consumer: string;
    blockTime?: number;
    batchSize?: number;
    handler: (data: unknown) => Promise<void>;
}

export enum EVENT_SUBJECT {
    // ASSET SUBJECTS
    ADD_ASSET = "engine.asset.add",
    UPDATE_ASSET = "engine.asset.update",
    DELETE_ASSET = "engine.asset.delete",

    // MARKET SUBJECTS
    ADD_MARKET = "engine.market.add",
    UPDATE_MARKET = "engine.market.update",
    DELETE_MARKET = "engine.market.delete",

    // USER SUBJECTS
    USER_ADD = "engine.user.add",

    // BALANCE SUBJECTS
    ON_RAMP = "engine.balance.onramp",
    OFF_RAMP = "engine.balance.offramp",
    GET_BALANCES = "engine.balance.get",

    // ORDER SUBJECTS
    ORDER_CREATE = "engine.order.create",
    ORDER_CANCEL = "engine.order.cancel",
    GET_ONE_OPEN_ORDER = "engine.order.open.one",
    GET_ALL_OPEN_ORDER = "engine.order.open.all",
    DELETE_ALL_OPEN_ORDER = "engine.order.open.delete",

    // POSITION
    GET_USER_OPEN_POSITION = "engine.position.get",
    GET_ALL_USER_OPEN_POSITION = "engine.position.get.all",

    // DEPTH SUBJECTS
    GET_MARKET_DEPTH = "engine.depth.get",

    // TICKER SUBJECTS
    GET_ONE_TICKER = "engine.ticker.get.one",
    GET_ALL_TICKER = "engine.ticker.get.all",

    // INDEX PRICE SUBJECTS
    INDEX_PRICE_UPDATE_EVENT = "engine.indexprice.update",

    // FUNDING RATE SUBJECTS
    FUNDING_RATE_UPDATE_EVENT = "engine.fundingrate.update",

    // MARKET RISK
    GET_ONE_MARKET_RISK = "engine.marketrisk.get.one",
    GET_ALL_MARKET_RISK = "engine.markprice.get.all",

    // OPEN INTEREST SUBJECTS
    GET_ONE_OPEN_INTEREST = "engine.openinterest.get.one",
    GET_ALL_OPEN_INTEREST = "engine.openinterest.get.all",

    // HEALTH SUBJECTS
    HEALTH_CHECK = "engine.heath.check",
}

export enum EVENT_SOURCE {
    BACKEND = "backend",
    WS = "ws",
}
