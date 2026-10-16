"use client"

import { Button } from "@workspace/ui/components/button";
import { Panel } from "./Shell";
import { useEffect, useState } from "react";
import { AddUpdateMarket } from "../forms/market-update";
import { useTerminal } from "@/lib/terminal-client.ts/terminal-store";
import { deleteMarket, getAllMarkets } from "@/lib/api-client/market-manager";
import { toast } from "@workspace/ui/components/toast";
import { getAuthession } from "@/lib/auth-client";
import { ResponsePanel } from "./response-panel";
import { ResponseEntry } from "@/lib/response-client.ts/response-viewer";

type Market = {
    id: string;
    symbol: string;
    marketType: string;
    baseAssetId: string;
    quoteAssetId: string;
    tickSize: string;
    lotSize: string;
};

export function MarketPanel() {
    const { append } = useTerminal();
    const [markets, setMarkets] = useState<Market[]>([]);
    const [adminKey, setAdminKey] = useState("");
    const [loading, setLoading] = useState(false);

    async function refreshCatalog() {
        setLoading(true);

        append({
            requestType: "REQ",
            requestMethod: "GET",
            endpoint: "/api/v1/market",
            message: `Fetching market catalog`,
        });

        try {
            const res = await getAllMarkets();
            append(res);

            if (res.success) {
                setMarkets(((res.data as { markets?: Market[] })?.markets) ?? []);
            }
        } catch {
            append({
                requestType: "REQ",
                requestMethod: "GET",
                endpoint: "/api/v1/market",
                message: `Something went wrong`,
            });
        } finally {
            setLoading(false);
        }
    }


    useEffect(() => {
        const timer = setTimeout(() => refreshCatalog(), 0);
        return () => clearTimeout(timer);
    }, [])


    const history: ResponseEntry[] = [];


    return (
        <>
            <div className="flex min-h-0 flex-col gap-px bg-border">

                {/* Market list */}
                <Panel
                    className="flex-1"
                    title="market.catalog"
                    right={
                        <Button
                            onClick={() => void refreshCatalog()}
                            disabled={loading}
                            className="hover:text-term-yellow border-0 disabled:opacity-50"
                        >
                            {loading ? "[loading]" : "[refresh catalog]"}
                        </Button>
                    }
                >
                    <MarketCatalogTab markets={markets} />
                </Panel>

                {/* Create - update market */}
                <Panel title="market.mutate · create / update">
                    <AddUpdateMarket adminKey={adminKey} markets={markets} onDone={refreshCatalog} />
                </Panel>

                {/* Delete market */}
                <Panel title="market.delete">
                    <MarketDeleteTab markets={markets} adminKey={adminKey} onDone={refreshCatalog} />
                </Panel>
            </div>

            <div className="flex min-h-0 flex-col gap-px bg-border">
                <Panel title="admin.key">
                    <div className="p-3">
                        <label className="block text-[12px]">
                            <div className="text-term-dim">admin key</div>
                            <input
                                className="w-full border border-border bg-input px-2 py-1 font-mono text-foreground outline-none focus:border-term-green"
                                type="password"
                                value={adminKey}
                                placeholder="try this key... c5f22fdf"
                                onChange={(e) => setAdminKey(e.target.value)}
                            />
                        </label>
                    </div>
                </Panel>
                <MarketInspect markets={markets} />
                <ResponsePanel data={history} title={`asset.request_history · ${history.length} calls`} />
            </div>
        </>
    )
}

function MarketDeleteTab(
    { markets, adminKey, onDone }:
        { markets: Market[], adminKey: string, onDone: () => void }
) {
    const { append } = useTerminal();
    const [symbol, setSymbol] = useState("");
    const [loading, setLoading] = useState(false);

    async function submit() {
        if (!symbol) {
            toast.add({ title: "Request Validation Error", description: "Select a market to delete" });
            return;
        }

        const token = getAuthession()?.token;

        if (!token) {
            toast.add({ title: "Request Validation Error", description: "No stored session, please signin as an admin first" });
            return;
        }

        setLoading(true);

        append({
            requestType: "REQ",
            requestMethod: "DELETE",
            endpoint: `/api/v1/market/${symbol}`,
            message: `Sending delete market request`,
        });

        try {
            const res = await deleteMarket({ token, adminKey, symbol });
            append(res);
            toast.add({
                title: res.success === false ? "Backend Response Error" : "Backend Response",
                description: res.message,
            })

            if (res.success) onDone();
        } catch {
            append({
                requestType: "REQ",
                requestMethod: "DELETE",
                endpoint: `/api/v1/market/${symbol}`,
                message: `Something went wrong`,
            });
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="grid gap-3 p-3 text-[12px] md:grid-cols-[1fr_auto]">
            <div>
                <div className="text-term-dim">selected_market</div>
                <select
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    className="w-full border border-border bg-input px-2 py-1 font-mono outline-none focus:border-term-red"
                >
                    <option value="">-- select --</option>
                    {markets.map((market) => <option key={market.id} value={market.symbol}>{market.symbol}</option>)}
                </select>
            </div>
            <div className="flex items-end gap-2">
                <button
                    type="button"
                    disabled={loading}
                    onClick={() => void submit()}
                    className="border border-term-red px-3 py-1 text-term-red disabled:opacity-50"
                >
                    {loading ? "deleting..." : "DELETE market"}
                </button>
            </div>
        </div>
    )
}

function MarketCatalogTab({ markets }: { markets: Market[] }) {
    return (
        <table className="w-full text-[12px]">
            <thead className="sticky top-0 border-b border-border bg-secondary text-left text-[11px] uppercase text-muted-foreground">
                <tr>
                    <th className="px-3 py-1">market</th>
                    <th className="px-3 py-1">type</th>
                    <th className="px-3 py-1">base / quote</th>
                    <th className="px-3 py-1 text-right">tick</th>
                    <th className="px-3 py-1 text-right">lot</th>
                </tr>
            </thead>
            <tbody>{markets.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-3 text-term-dim">{"// waiting for GET /api/v1/market"}</td></tr>
            ) : markets.map((market) => (
                <tr key={market.id} className="border-b border-border hover:bg-accent/40">
                    <td className="px-3 py-1 text-term-cyan">{market.symbol}</td>
                    <td className="px-3 py-1 text-term-dim">{market.marketType}</td>
                    <td className="px-3 py-1 text-term-dim">{market.baseAssetId} / {market.quoteAssetId}</td>
                    <td className="px-3 py-1 text-right">{market.tickSize}</td>
                    <td className="px-3 py-1 text-right">{market.lotSize}</td>
                </tr>
            ))}</tbody>
        </table>
    )
}

export function MarketInspect({ markets }: { markets: Market[] }) {
    return (
        <Panel title="market.inspect">
            <MarketInspectTab markets={markets} />
        </Panel>
    )
}

function MarketInspectTab({ markets }: { markets: Market[] }) {
    const [selectedMarket, setSelectedMarket] = useState("");
    return (
        <div className="grid gap-3 p-3 text-[12px] md:grid-cols-[1fr_auto]">
            <div>
                <div className="text-term-dim">selected_market</div>
                <select
                    value={selectedMarket}
                    onChange={(e) => setSelectedMarket(e.target.value)}
                    className="w-full border border-border bg-input px-2 py-1 font-mono outline-none focus:border-term-red"
                >
                    <option value="">-- select --</option>
                    {markets.map((market) => <option key={market.id} value={market.symbol}>{market.symbol}</option>)}
                </select>
            </div>
            <div className="flex items-end gap-2">
                <button className="border border-term-green px-3 py-1 text-term-green">SNAPSHOT</button>
                <button className="border border-term-cyan px-3 py-1 text-term-cyan">DEPTH</button>
            </div>
        </div>
    )
}
