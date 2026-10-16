import { AddAssetRequestPayload, AddMarketRequestPayload, Asset, DeleteAssetRequestPayload, DeleteMarketRequestPayload, EVENT_REJECT_CODES, Market, MarketSnapshot, MarketType, UpdateAssetRequestPayload, UpdateMarketRequestPayload } from "@workspace/shared";
import { prisma } from "@workspace/database"
import { RejectError } from "../utils/error";
import { MatchingEngine } from "./matching-engine";
import { PositionMatchingEngine } from "./position-engine";
import { FundManagementEngine } from "./fund-management-engine";
import { EngineState } from "./engine-state";

const SYSTEM_USER_ID = "system";

export class MarketEngine {
    constructor(
        private readonly state: EngineState,
        private readonly matchingEngine: MatchingEngine,
        private readonly positionEngine: PositionMatchingEngine,
        private readonly fundManagementEngine: FundManagementEngine,
    ) { }

    async initializeMarkets() {
        const assets = await prisma.asset.findMany({ where: { isActive: true } });
        const markets = await prisma.market.findMany({ where: { isActive: true } });

        for (const asset of assets) {
            this.addAsset({
                userId: SYSTEM_USER_ID,
                symbol: asset.symbol,
                name: asset.name,
                type: asset.type,
                precision: asset.precision,
                isActive: asset.isActive,
                logoUrl: asset.logoUrl ?? undefined,
            });
        }

        for (const market of markets) {
            this.addMarket({
                userId: SYSTEM_USER_ID,
                symbol: market.symbol,
                name: market.name,
                marketType: market.marketType as MarketType,
                baseAssetSymbol: market.baseAssetId,
                quoteAssetSymbol: market.quoteAssetId,
                maxLeverage: market.maxLeverage,
                minQty: market.minOrderSize,
                tickSize: market.tickSize,
                lotSize: market.lotSize,
                // NOTE: minNotional is not stored on the Market table yet, default to 0.
                minNotional: 0,
                isActive: market.isActive,
            });
        }
    }

    restoreMarket(market: Market, snapshot?: MarketSnapshot) {
        this.state.markets.set(market.symbol, market);

        this.matchingEngine.initializeOrderBook(market);
        this.positionEngine.initializeMarket(market);
        this.fundManagementEngine.initializeMarket(market.symbol);

        if (!snapshot) return;

        this.state.orderbooks.get(market.symbol)?.restoreSnapshot(snapshot.orderbook);
        this.state.positions.get(market.symbol)?.restoreSnapshot(snapshot.positions);
    }

    addAsset(payload: AddAssetRequestPayload): Asset {
        const { symbol, name, precision, type } = payload;

        const asset: Asset = {
            symbol, name, precision, isActive: true, type
        }

        this.state.assets.set(symbol, asset);

        return asset;
    }

    updateAsset(payload: UpdateAssetRequestPayload): Asset {
        const asset = this.state.assets.get(payload.symbol);

        if (!asset) throw new RejectError(EVENT_REJECT_CODES.ASSET_NOT_EXISTS, "The asset does not exists in the market");

        asset.precision = payload.precision ? payload.precision : asset.precision;
        asset.name = payload.name ? payload.name : asset.name;

        return asset;
    }

    deleteAsset(payload: DeleteAssetRequestPayload): Asset {
        const asset = this.state.assets.get(payload.symbol);

        if (!asset) throw new RejectError(EVENT_REJECT_CODES.ASSET_NOT_EXISTS, "The asset does not exists in the market");

        asset.isActive = false;

        return asset;

    }

    addMarket(payload: AddMarketRequestPayload): Market {
        const baseAsset = this.state.assets.get(payload.baseAssetSymbol);
        const quoteAsset = this.state.assets.get(payload.quoteAssetSymbol);

        if (!baseAsset || !quoteAsset) {
            return this.reject(EVENT_REJECT_CODES.INVALID_ASSET, "Base & Quote asset is required");
        }
        const market: Market = {
            ...payload,
            baseAsset: baseAsset,
            quoteAsset: quoteAsset,
            minQty: Number(payload.minQty),
            tickSize: Number(payload.tickSize),
            lotSize: Number(payload.lotSize)
        }

        this.state.markets.set(payload.symbol, market);
        this.state.marketRisk.set(payload.symbol, {
            indexPrice: undefined,
            indexUpdatedAt: Date.now(),
            markPrice: undefined,
            markUpdatedAt: Date.now(),
            lastFundingRateBps: 0,
            lastFundingSettledAt: 0,
        })

        this.matchingEngine.initializeOrderBook(market);
        this.positionEngine.initializeMarket(market);
        this.fundManagementEngine.initializeMarket(market.symbol);

        return market;
    }

    updateMarket(payload: UpdateMarketRequestPayload): Market {
        const market = this.state.markets.get(payload.symbol);

        if (!market) {
            return this.reject(EVENT_REJECT_CODES.MARKET_NOT_FOUND, "The market with this symbol is not present");
        }

        const updatedMarket: Market = {
            ...market,
            ...payload,
            minQty: payload.minQty ? Number(payload.minQty) : market.minQty,
            tickSize: payload.tickSize ? Number(payload.tickSize) : market.tickSize,
            lotSize: payload.lotSize ? Number(payload.lotSize) : market.lotSize
        }

        this.state.markets.set(payload.symbol, updatedMarket)

        return updatedMarket;
    }

    deleteMarket(payload: DeleteMarketRequestPayload): Market {
        const market = this.state.markets.get(payload.symbol);

        if (!market) {
            return this.reject(EVENT_REJECT_CODES.MARKET_NOT_FOUND, "The market with this symbol is not present");
        }

        this.state.markets.delete(payload.symbol);

        return market;
    }

    private reject(code: EVENT_REJECT_CODES, message: string): never {

        throw new RejectError(code, message);
    }

}