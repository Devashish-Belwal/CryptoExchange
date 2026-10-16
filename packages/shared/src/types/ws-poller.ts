export type MarkPrice = {
    E: number;
    s: string;
    p: string;
    i: string;
};

export type CombinedStreamMessage = {
    stream: string;
    data: MarkPrice | MarkPrice[];
};

export type LatestPrice = {
    indexPrice: string;
    markPrice: string;
};

export type latestPricesMapType = Map<string, LatestPrice>;

export type WsPollerHealthState = {
    websocketConnected: boolean;
    lastMessageAt: number;
    redisHealthy: boolean;
    startedAt: number;
}