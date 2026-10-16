export type MarketChannelKind = "depth" | "ticker" | "markprice" | "trade";

const MARKET_CHANNEL_KINDS: Set<string> = new Set(["depth", "ticker", "markprice", "trade"]);

export function isMarketChannelKind(kind: string): kind is MarketChannelKind {
    return MARKET_CHANNEL_KINDS.has(kind);
}
