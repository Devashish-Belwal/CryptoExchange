import { AssetsType, BalanceType, FundingPayments, MarketFunds, MarketRiskStates, MarketsType, TickerUpdate } from "@workspace/shared";
import { OrderbookEngine } from "./single-orderbook";
import { PositionEngine } from "./single-position";

export class EngineState {
    assets: AssetsType = new Map();

    markets: MarketsType = new Map();

    balances: BalanceType = new Map();

    orderbooks: Map<string, OrderbookEngine> = new Map();

    positions: Map<string, PositionEngine> = new Map();

    marketRisk: MarketRiskStates = new Map();

    fundingPayments: FundingPayments = [];

    insuranceFunds: MarketFunds = new Map();

    commissionFunds: MarketFunds = new Map();

    // Day-based rolling ticker per symbol, reset when a trade lands on a new
    // UTC day. See update-manager-engine.ts for how it's maintained.
    dailyTickers: Map<string, TickerUpdate> = new Map();
}