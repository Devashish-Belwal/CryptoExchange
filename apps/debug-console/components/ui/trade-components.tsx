"use client"

import { Button } from "@workspace/ui/components/button";
import { Panel } from "./Shell";
import { useEffect, useState } from "react";
import { useTerminal } from "@/lib/terminal-client.ts/terminal-store";
import { getAllMarkets } from "@/lib/api-client/market-manager";
import {
    cancelAllOrders, getDepth, getKlines, getMarketRisk, getMarketTrades,
    getOpenInterest, getOpenOrders, getOpenPosition, getTicker,
} from "@/lib/api-client/trade-manager";
import { getAuthession } from "@/lib/auth-client";
import { toast } from "@workspace/ui/components/toast";
import { Candle, TickerChart } from "./ticker-chart";
import { CreateOrtder } from "../forms/create-order";
import { ResponsePanel } from "./response-panel";
import { Terminal } from "./terminal";
import { ResponseEntry } from "@/lib/response-client.ts/response-viewer";

type Market = {
    id: string;
    symbol: string;
    marketType: string;
    baseAssetId: string;
    quoteAssetId: string;
    maxLeverage: number;
    minOrderSize: string;
    tickSize: string;
    lotSize: string;
    minNotional: string;
};

const TIMEFRAMES = ["1m", "5m", "1h", "1w"];

export function TradeWorkspace() {
    const [markets, setMarkets] = useState<Market[]>([]);
    const [symbol, setSymbol] = useState("");
    const [timeframe, setTimeframe] = useState("1m");
    const [orderRefresh, setOrderRefresh] = useState(0);

    async function loadMarkets() {
        const res = await getAllMarkets();
        if (res.success) {
            const list = ((res.data as { markets?: Market[] })?.markets) ?? [];
            setMarkets(list);
            setSymbol((current) => current || list[0]?.symbol || "");
        }
    }

    useEffect(() => {
        const timer = setTimeout(() => loadMarkets(), 0);
        return () => clearTimeout(timer);
    }, []);

    const market = markets.find((m) => m.symbol === symbol);
    const history: ResponseEntry[] = [];

    return (
        <main className="flex-1 overflow-auto bg-border">
            <div className="flex flex-col gap-px">

                {/* chart & orderbook */}
                <div className="grid grid-cols-12 gap-px" style={{ minHeight: 240 }}>
                    <ChartPanel symbol={symbol} timeframe={timeframe} setTimeframe={setTimeframe} />
                    <OrderBookPanel symbol={symbol} />
                </div>

                {/* market selector - market data - ws frames */}
                <div className="grid grid-cols-12 gap-px" style={{ minHeight: 300 }}>
                    <MarketPicker markets={markets} symbol={symbol} setSymbol={setSymbol} market={market} />
                    <MarketDataPanel symbol={symbol} />
                    <Panel title="websocket.frames" className="col-span-12 md:col-span-6 lg:col-span-3">
                        <div className="p-3 text-[11px] text-term-dim">
                            {"// live depth/trade/ticker frames arrive here once the ws layer is wired (NEXT_PUBLIC_CORE_WS_URL)"}
                        </div>
                    </Panel>
                </div>

                {/* order create - response - terminal */}
                <div className="grid h-[960px] min-h-0 grid-cols-12 grid-rows-3 gap-px overflow-hidden md:h-[700px] md:grid-rows-2 lg:h-[440px] lg:grid-rows-1">
                    <Panel title="order.create · complete backend payload" className="col-span-12 min-h-0 overflow-hidden lg:col-span-4">
                        <CreateOrtder symbol={symbol} market={market} onDone={() => setOrderRefresh((n) => n + 1)} />
                    </Panel>

                    <ResponsePanel
                        title={`request.response_history · ${history.length} calls`}
                        data={history}
                        classname="col-span-12 min-h-0 overflow-hidden md:col-span-6 lg:col-span-4"
                    />

                    <div className="col-span-12 flex min-h-0 overflow-hidden md:col-span-6 lg:col-span-4">
                        <Terminal title="stdout · trade.engine" className="w-full" />
                    </div>
                </div>

                {/* open orders & positions */}
                <div className="grid grid-cols-12 gap-px" style={{ minHeight: 240 }}>
                    <OpenOrdersPanel symbol={symbol} refreshKey={orderRefresh} />
                    <OpenPositionsPanel symbol={symbol} refreshKey={orderRefresh} />
                </div>

            </div>
        </main>
    )
}

function ChartPanel(
    { symbol, timeframe, setTimeframe }:
        { symbol: string, timeframe: string, setTimeframe: (value: string) => void }
) {
    const { append } = useTerminal();
    const [candles, setCandles] = useState<Candle[]>([]);
    const [loading, setLoading] = useState(false);

    async function load() {
        if (!symbol) return;
        setLoading(true);

        append({ requestType: "REQ", requestMethod: "GET", endpoint: `/api/v1/klines/${symbol}`, message: `Fetching ${timeframe} klines` });

        try {
            const res = await getKlines({ symbol, interval: timeframe });
            append(res);
            if (res.success) setCandles((res.data as Candle[]) ?? []);
        } catch {
            append({ requestType: "REQ", requestMethod: "GET", endpoint: `/api/v1/klines/${symbol}`, message: `Something went wrong` });
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        const timer = setTimeout(() => load(), 0);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [symbol, timeframe]);

    return (
        <Panel
            title={`ticker.chart · ${symbol || "—"} · ${timeframe}`}
            className="h-[310px] shrink-0 col-span-12 lg:col-span-8"
            right={
                <span className="space-x-1">
                    {TIMEFRAMES.map((tf) => (
                        <Button
                            key={tf}
                            onClick={() => setTimeframe(tf)}
                            className={`border-0 disabled:opacity-50 ${tf === timeframe ? "text-term-cyan" : "hover:text-term-yellow"}`}
                        >
                            {`[${tf}]`}
                        </Button>
                    ))}
                </span>
            }
        >
            <div className="h-full w-full p-1">
                {loading && candles.length === 0
                    ? <div className="p-3 text-[12px] text-term-dim">{"// loading klines..."}</div>
                    : <TickerChart candles={candles} />}
            </div>
        </Panel>
    )
}

function OrderBookPanel({ symbol }: { symbol: string }) {
    const { append } = useTerminal();
    const [tab, setTab] = useState<"book" | "trade">("book");
    const [depth, setDepth] = useState<{ bids: [string, string][], asks: [string, string][] }>({ bids: [], asks: [] });
    const [trades, setTrades] = useState<{ id: string, price: string, quantity: string, isBuyerMaker: boolean }[]>([]);
    const [loading, setLoading] = useState(false);

    async function load() {
        if (!symbol) return;
        setLoading(true);

        const endpoint = tab === "book" ? `/api/v1/depth/${symbol}` : `/api/v1/trades/${symbol}`;
        append({ requestType: "REQ", requestMethod: "GET", endpoint, message: `Fetching ${tab} snapshot` });

        try {
            if (tab === "book") {
                const res = await getDepth({ symbol });
                append(res);
                if (res.success) setDepth(((res.data as { depths?: { bids: [string, string][], asks: [string, string][] } })?.depths) ?? { bids: [], asks: [] });
            } else {
                const res = await getMarketTrades({ symbol });
                append(res);
                if (res.success) setTrades((res.data as typeof trades) ?? []);
            }
        } catch {
            append({ requestType: "REQ", requestMethod: "GET", endpoint, message: `Something went wrong` });
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        const timer = setTimeout(() => load(), 0);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [symbol, tab]);

    return (
        <Panel
            title="orderbook · engine L2"
            className="col-span-12 md:col-span-6 lg:col-span-4"
            right={
                <span className="space-x-1">
                    {(["book", "trade"] as const).map((candidate) => (
                        <Button
                            key={candidate}
                            onClick={() => setTab(candidate)}
                            className={`border-0 disabled:opacity-50 ${candidate === tab ? "text-term-cyan" : "hover:text-term-yellow"}`}
                        >
                            {`[${candidate}]`}
                        </Button>
                    ))}
                </span>
            }
        >
            {tab === "book" ? (
                <table className="w-full text-[12px]">
                    <thead className="border-b border-border bg-secondary text-left text-[11px] uppercase text-muted-foreground">
                        <tr><th className="px-3 py-1">price</th><th className="px-3 py-1 text-right">size (bid)</th><th className="px-3 py-1 text-right">size (ask)</th></tr>
                    </thead>
                    <tbody>
                        {depth.asks.slice().reverse().map(([price, size], i) => (
                            <tr key={`a-${i}`} className="border-b border-border"><td className="px-3 py-0.5 text-term-red">{price}</td><td className="px-3 py-0.5 text-right text-term-dim"></td><td className="px-3 py-0.5 text-right">{size}</td></tr>
                        ))}
                        {depth.bids.map(([price, size], i) => (
                            <tr key={`b-${i}`} className="border-b border-border"><td className="px-3 py-0.5 text-term-green">{price}</td><td className="px-3 py-0.5 text-right">{size}</td><td className="px-3 py-0.5 text-right text-term-dim"></td></tr>
                        ))}
                        {depth.bids.length === 0 && depth.asks.length === 0 && (
                            <tr><td colSpan={3} className="px-3 py-3 text-term-dim">{loading ? "// loading depth..." : "// empty book"}</td></tr>
                        )}
                    </tbody>
                </table>
            ) : (
                <table className="w-full text-[12px]">
                    <thead className="border-b border-border bg-secondary text-left text-[11px] uppercase text-muted-foreground">
                        <tr><th className="px-3 py-1">price</th><th className="px-3 py-1 text-right">qty</th><th className="px-3 py-1 text-right">side</th></tr>
                    </thead>
                    <tbody>{trades.length === 0 ? (
                        <tr><td colSpan={3} className="px-3 py-3 text-term-dim">{loading ? "// loading trades..." : "// no trades"}</td></tr>
                    ) : trades.map((trade) => (
                        <tr key={trade.id} className="border-b border-border">
                            <td className={trade.isBuyerMaker ? "px-3 py-0.5 text-term-green" : "px-3 py-0.5 text-term-red"}>{trade.price}</td>
                            <td className="px-3 py-0.5 text-right">{trade.quantity}</td>
                            <td className="px-3 py-0.5 text-right text-term-dim">{trade.isBuyerMaker ? "BUY" : "SELL"}</td>
                        </tr>
                    ))}</tbody>
                </table>
            )}
        </Panel>
    )
}

function MarketPicker(
    { markets, symbol, setSymbol, market }:
        { markets: Market[], symbol: string, setSymbol: (value: string) => void, market?: Market }
) {
    return (
        <Panel title={`market · ${symbol || "—"}`} className="col-span-12 lg:col-span-4">
            <div className="grid gap-3 p-3 text-[12px]">
                <label>
                    <span className="text-term-dim">market_id</span>
                    <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className={inputCls}>
                        {markets.map((m) => <option key={m.id} value={m.symbol}>{m.symbol}</option>)}
                    </select>
                </label>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    <Metric label="type" value={market?.marketType ?? "—"} />
                    <Metric label="base" value={market?.baseAssetId ?? "—"} />
                    <Metric label="quote" value={market?.quoteAssetId ?? "—"} />
                    <Metric label="max leverage" value={market ? `${market.maxLeverage}x` : "—"} />
                </div>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    <Metric label="min qty" value={market?.minOrderSize ?? "—"} />
                    <Metric label="tick" value={market?.tickSize ?? "—"} />
                    <Metric label="lot" value={market?.lotSize ?? "—"} />
                    <Metric label="min notional" value={market?.minNotional ?? "—"} />
                </div>
            </div>
        </Panel>
    )
}

function MarketDataPanel({ symbol }: { symbol: string }) {
    const { append } = useTerminal();
    const [ticker, setTicker] = useState<any>(null);
    const [openInterest, setOpenInterest] = useState<any>(null);
    const [risk, setRisk] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    async function load() {
        if (!symbol) return;
        setLoading(true);

        append({ requestType: "REQ", requestMethod: "GET", endpoint: `/api/v1/tickers/${symbol}`, message: `Fetching ticker, open interest & risk` });

        try {
            const [tickerRes, oiRes, riskRes] = await Promise.all([
                getTicker({ symbol }),
                getOpenInterest({ symbol }),
                getMarketRisk({ symbol }),
            ]);

            append(tickerRes);
            append(oiRes);
            append(riskRes);

            if (tickerRes.success) setTicker(tickerRes.data ?? null);
            if (oiRes.success) setOpenInterest((oiRes.data as { openInterest?: any })?.openInterest ?? null);
            if (riskRes.success) setRisk((riskRes.data as { risk?: any })?.risk ?? null);
        } catch {
            append({ requestType: "REQ", requestMethod: "GET", endpoint: `/api/v1/tickers/${symbol}`, message: `Something went wrong` });
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        const timer = setTimeout(() => load(), 0);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [symbol]);

    return (
        <Panel
            title={`market.data · ${symbol || "—"}`}
            className="col-span-12 lg:col-span-5"
            right={<Button onClick={() => void load()} disabled={loading} className="hover:text-term-yellow border-0 disabled:opacity-50">{loading ? "[loading]" : "[refresh]"}</Button>}
        >
            <div className="grid gap-3 p-3 text-[12px]">
                <Section label="ticker">
                    <Metric label="last" value={ticker?.lastPrice ?? "—"} />
                    <Metric label="24h %" value={ticker?.priceChangePercentage ?? "—"} />
                    <Metric label="high" value={ticker?.high ?? "—"} />
                    <Metric label="low" value={ticker?.low ?? "—"} />
                    <Metric label="volume" value={ticker?.volume ?? "—"} />
                    <Metric label="trades" value={ticker ? String(ticker.trades) : "—"} />
                </Section>
                <Section label="open interest">
                    <Metric label="volume" value={openInterest?.volume ?? "—"} />
                    <Metric label="quantity" value={openInterest?.quantity ?? "—"} />
                    <Metric label="last" value={openInterest?.lastPrice ?? "—"} />
                </Section>
                <Section label="market risk">
                    <Metric label="mark" value={risk?.markPrice != null ? String(risk.markPrice) : "—"} />
                    <Metric label="index" value={risk?.indexPrice != null ? String(risk.indexPrice) : "—"} />
                    <Metric label="funding bps" value={risk?.lastFundingRateBps != null ? String(risk.lastFundingRateBps) : "—"} />
                </Section>
            </div>
        </Panel>
    )
}

function OpenOrdersPanel({ symbol, refreshKey }: { symbol: string, refreshKey: number }) {
    const { append } = useTerminal();
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    async function load() {
        const token = getAuthession()?.token;
        if (!symbol || !token) return;

        setLoading(true);
        append({ requestType: "REQ", requestMethod: "GET", endpoint: `/api/v1/order/${symbol}/all`, message: `Fetching open orders` });

        try {
            const res = await getOpenOrders({ token, symbol });
            append(res);
            if (res.success) setOrders(((res.data as { orders?: any[] })?.orders) ?? []);
        } catch {
            append({ requestType: "REQ", requestMethod: "GET", endpoint: `/api/v1/order/${symbol}/all`, message: `Something went wrong` });
        } finally {
            setLoading(false);
        }
    }

    async function cancelAll() {
        const token = getAuthession()?.token;
        if (!token) {
            toast.add({ title: "Request Validation Error", description: "No stored session, please signin first" });
            return;
        }

        append({ requestType: "REQ", requestMethod: "DELETE", endpoint: `/api/v1/order/${symbol}/all`, message: `Cancelling all open orders` });

        try {
            const res = await cancelAllOrders({ token, symbol });
            append(res);
            toast.add({ title: res.success === false ? "Backend Response Error" : "Backend Response", description: res.message });
            if (res.success) void load();
        } catch {
            append({ requestType: "REQ", requestMethod: "DELETE", endpoint: `/api/v1/order/${symbol}/all`, message: `Something went wrong` });
        }
    }

    useEffect(() => {
        const timer = setTimeout(() => load(), 0);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [symbol, refreshKey]);

    return (
        <Panel
            title={`open.orders · ${symbol || "—"}`}
            className="col-span-12 lg:col-span-5"
            right={
                <span className="space-x-2">
                    <Button onClick={() => void load()} disabled={loading} className="hover:text-term-yellow border-0 disabled:opacity-50">{loading ? "[loading]" : "[refresh]"}</Button>
                    <Button onClick={() => void cancelAll()} className="hover:text-term-red border-0">[cancel all]</Button>
                </span>
            }
        >
            <table className="w-full text-[12px]">
                <thead className="border-b border-border bg-secondary text-left text-[11px] uppercase text-muted-foreground">
                    <tr><th className="px-3 py-1">order</th><th className="px-3 py-1">side</th><th className="px-3 py-1">type</th><th className="px-3 py-1">status</th><th className="px-3 py-1 text-right">price</th><th className="px-3 py-1 text-right">filled / qty</th></tr>
                </thead>
                <tbody>{orders.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-3 text-term-dim">{"// no open orders — sign in, then refresh"}</td></tr>
                ) : orders.map((order) => (
                    <tr key={order.orderId} className="border-b border-border hover:bg-accent/40">
                        <td className="px-3 py-1 text-term-cyan">{order.orderId}</td>
                        <td className={order.side === "BUY" ? "px-3 py-1 text-term-green" : "px-3 py-1 text-term-red"}>{order.side}</td>
                        <td className="px-3 py-1 text-term-dim">{order.type}</td>
                        <td className="px-3 py-1 text-term-dim">{order.status}</td>
                        <td className="px-3 py-1 text-right">{order.entryPrice}</td>
                        <td className="px-3 py-1 text-right text-term-dim">{order.filledQuantity} / {order.quantity}</td>
                    </tr>
                ))}</tbody>
            </table>
        </Panel>
    )
}

function OpenPositionsPanel({ symbol, refreshKey }: { symbol: string, refreshKey: number }) {
    const { append } = useTerminal();
    const [positions, setPositions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    async function load() {
        const token = getAuthession()?.token;
        if (!symbol || !token) return;

        setLoading(true);
        append({ requestType: "REQ", requestMethod: "GET", endpoint: `/api/v1/position/${symbol}`, message: `Fetching open position` });

        try {
            const res = await getOpenPosition({ token, symbol });
            append(res);
            if (res.success) {
                const position = (res.data as { position?: any })?.position;
                setPositions(position ? [position] : []);
            } else {
                setPositions([]);
            }
        } catch {
            append({ requestType: "REQ", requestMethod: "GET", endpoint: `/api/v1/position/${symbol}`, message: `Something went wrong` });
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        const timer = setTimeout(() => load(), 0);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [symbol, refreshKey]);

    return (
        <Panel
            title={`market.position · ${symbol || "—"}`}
            className="col-span-12 lg:col-span-7"
            right={<Button onClick={() => void load()} disabled={loading} className="hover:text-term-yellow border-0 disabled:opacity-50">{loading ? "[loading]" : "[refresh]"}</Button>}
        >
            <table className="w-full text-[12px]">
                <thead className="border-b border-border bg-secondary text-left text-[11px] uppercase text-muted-foreground">
                    <tr><th className="px-3 py-1">position</th><th className="px-3 py-1">side</th><th className="px-3 py-1 text-right">lev</th><th className="px-3 py-1 text-right">entry</th><th className="px-3 py-1 text-right">qty</th><th className="px-3 py-1 text-right">liq</th><th className="px-3 py-1 text-right">upnl</th></tr>
                </thead>
                <tbody>{positions.length === 0 ? (
                    <tr><td colSpan={7} className="px-3 py-3 text-term-dim">{"// no open position — sign in, then refresh"}</td></tr>
                ) : positions.map((position) => (
                    <tr key={position.positionId} className="border-b border-border hover:bg-accent/40">
                        <td className="px-3 py-1 text-term-cyan">{position.positionId}</td>
                        <td className={position.position === "LONG" ? "px-3 py-1 text-term-green" : "px-3 py-1 text-term-red"}>{position.position}</td>
                        <td className="px-3 py-1 text-right text-term-dim">{position.leverage}x</td>
                        <td className="px-3 py-1 text-right">{position.entryPrice}</td>
                        <td className="px-3 py-1 text-right">{position.quantity}</td>
                        <td className="px-3 py-1 text-right text-term-yellow">{position.liquidationPrice}</td>
                        <td className={Number(position.upnl) >= 0 ? "px-3 py-1 text-right text-term-green" : "px-3 py-1 text-right text-term-red"}>{position.upnl}</td>
                    </tr>
                ))}</tbody>
            </table>
        </Panel>
    )
}

const inputCls = "w-full border border-border bg-input px-2 py-1 font-mono text-foreground outline-none focus:border-term-green disabled:opacity-50";

function Section({ label, children }: { label: string, children: React.ReactNode }) {
    return (
        <div>
            <div className="mb-1 text-[10px] uppercase text-term-dim">{label}</div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">{children}</div>
        </div>
    )
}

function Metric({ label, value }: { label: string; value: string }) {
    return (
        <div className="border border-border bg-secondary p-2">
            <div className="text-[10px] uppercase text-term-dim">{label}</div>
            <div className="truncate text-term-cyan">{value}</div>
        </div>
    )
}
