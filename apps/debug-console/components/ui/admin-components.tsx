"use client"

import { Button } from "@workspace/ui/components/button";
import { Panel } from "./Shell";
import { useEffect, useState } from "react";
import { useTerminal } from "@/lib/terminal-client.ts/terminal-store";
import { getAllFunds, getFundsBySymbol } from "@/lib/api-client/fund-manager";
import { getAllMarkets } from "@/lib/api-client/market-manager";
import { getAuthession } from "@/lib/auth-client";
import { toast } from "@workspace/ui/components/toast";

type Fund = {
    id: string;
    symbol: string;
    type: string;
    balance: string;
};

type Market = { id: string; symbol: string };

export function AdminPanel() {
    const { append } = useTerminal();
    const [funds, setFunds] = useState<Fund[]>([]);
    const [markets, setMarkets] = useState<Market[]>([]);
    const [adminKey, setAdminKey] = useState("");
    const [loading, setLoading] = useState(false);

    async function loadMarkets() {
        const res = await getAllMarkets();
        if (res.success) {
            setMarkets(((res.data as { markets?: Market[] })?.markets) ?? []);
        }
    }

    useEffect(() => {
        const timer = setTimeout(() => loadMarkets(), 0);
        return () => clearTimeout(timer);
    }, []);

    async function refreshCatalog() {
        if (!adminKey) {
            toast.add({ title: "Request Validation Error", description: "Provide the admin key first" });
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
            requestMethod: "GET",
            endpoint: "/api/v1/funds",
            message: `Fetching funding catalog`,
        });

        try {
            const res = await getAllFunds({ token, adminKey });
            append(res);

            if (res.success) {
                setFunds(((res.data as { funds?: Fund[] })?.funds) ?? []);
            }
        } catch {
            append({
                requestType: "REQ",
                requestMethod: "GET",
                endpoint: "/api/v1/funds",
                message: `Something went wrong`,
            });
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="flex min-h-0 flex-col gap-px bg-border">

            <Panel title="admin.key">
                <div className="p-3">
                    <div className="text-term-dim text-[12px]">admin key</div>
                    <div className="flex gap-2 text-[12px]">
                        <input
                            className="flex-1 border border-border bg-input px-2 py-1 font-mono text-foreground outline-none focus:border-term-green"
                            type="password"
                            value={adminKey}
                            placeholder="try this key... c5f22fdf"
                            onChange={(e) => setAdminKey(e.target.value)}
                        />
                        <button
                            type="button"
                            disabled={!adminKey || loading}
                            onClick={() => void refreshCatalog()}
                            className="border border-term-green px-3 py-1 text-term-green disabled:opacity-50"
                        >
                            {loading ? "loading..." : "$ ./load"}
                        </button>
                    </div>
                </div>
            </Panel>

            {/* Funding list */}
            <Panel
                className="flex-1"
                title="funding.catalog"
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
                <FundingCatalogTab funds={funds} />
            </Panel>

            {/* Inspect funding by symbol */}
            <Panel title="funding.inspect">
                <FundingInspectTab funds={funds} adminKey={adminKey} />
            </Panel>

        </div>
    )
}

function FundingInspectTab(
    { funds, adminKey }:
        { funds: Fund[], adminKey: string }
) {
    const { append } = useTerminal();
    const [symbol, setSymbol] = useState("");
    const [loading, setLoading] = useState(false);

    const symbols = Array.from(new Set(funds.map((fund) => fund.symbol)));

    async function submit() {
        if (!symbol) {
            toast.add({ title: "Request Validation Error", description: "Select a market symbol to inspect" });
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
            requestMethod: "GET",
            endpoint: `/api/v1/funds/${symbol}`,
            message: `Fetching funding for ${symbol}`,
        });

        try {
            const res = await getFundsBySymbol({ token, adminKey, symbol });
            append(res);
            toast.add({
                title: res.success === false ? "Backend Response Error" : "Backend Response",
                description: res.message,
            })
        } catch {
            append({
                requestType: "REQ",
                requestMethod: "GET",
                endpoint: `/api/v1/funds/${symbol}`,
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
                    className="w-full border border-border bg-input px-2 py-1 font-mono outline-none focus:border-term-green"
                >
                    <option value="">-- select --</option>
                    {symbols.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>
            <div className="flex items-end gap-2">
                <button
                    type="button"
                    disabled={loading}
                    onClick={() => void submit()}
                    className="border border-term-green px-3 py-1 text-term-green disabled:opacity-50"
                >
                    {loading ? "fetching..." : "GET funding"}
                </button>
            </div>
        </div>
    )
}

function FundingCatalogTab({ funds }: { funds: Fund[] }) {
    return (
        <table className="w-full text-[12px]">
            <thead className="sticky top-0 border-b border-border bg-secondary text-left text-[11px] uppercase text-muted-foreground">
                <tr>
                    <th className="px-3 py-1">market</th>
                    <th className="px-3 py-1">type</th>
                    <th className="px-3 py-1 text-right">balance</th>
                </tr>
            </thead>
            <tbody>{funds.length === 0 ? (
                <tr><td colSpan={3} className="px-3 py-3 text-term-dim">{"// waiting for GET /api/v1/funds"}</td></tr>
            ) : funds.map((fund) => (
                <tr key={fund.id} className="border-b border-border hover:bg-accent/40">
                    <td className="px-3 py-1 text-term-cyan">{fund.symbol}</td>
                    <td className="px-3 py-1 text-term-dim">{fund.type}</td>
                    <td className="px-3 py-1 text-right">{fund.balance}</td>
                </tr>
            ))}</tbody>
        </table>
    )
}
