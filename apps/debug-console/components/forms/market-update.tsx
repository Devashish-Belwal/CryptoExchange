"use client"

import { useEffect, useState } from "react";
import { useTerminal } from "@/lib/terminal-client.ts/terminal-store";
import { createMarket, updateMarket } from "@/lib/api-client/market-manager";
import { getAllAssets } from "@/lib/api-client/asset-manager";
import { createMarketSchema, updateMarketSchema } from "@workspace/shared";
import { toast } from "@workspace/ui/components/toast";
import { getAuthession } from "@/lib/auth-client";

type Asset = { id: string; symbol: string; type: string };
type MarketOption = { id: string; symbol: string };

export function AddUpdateMarket(
    { adminKey, markets, onDone }:
        { adminKey: string, markets: MarketOption[], onDone: () => void }
) {
    const { append } = useTerminal();
    const [action, setAction] = useState<"ADD" | "UPDATE">("ADD");
    const [loading, setLoading] = useState(false);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [symbol, setSymbol] = useState("");
    const [name, setName] = useState("");
    const [marketType, setMarketType] = useState<"SPOT" | "PERP">("SPOT");
    const [baseAssetSymbol, setBaseAssetSymbol] = useState("");
    const [quoteAssetSymbol, setQuoteAssetSymbol] = useState("");
    const [maxLeverage, setMaxLeverage] = useState("1");
    const [minNotional, setMinNotional] = useState("1");
    const [minQty, setMinQty] = useState("");
    const [tickSize, setTickSize] = useState("");
    const [lotSize, setLotSize] = useState("");

    async function loadAssets() {
        const res = await getAllAssets();
        if (res.success) {
            setAssets(((res.data as { assets?: Asset[] })?.assets) ?? []);
        }
    }

    useEffect(() => {
        void loadAssets();
    }, []);

    const baseAssets = assets.filter((asset) => asset.type === "BASE");
    const quoteAssets = assets.filter((asset) => asset.type === "QUOTE");

    function resetForm() {
        setSymbol("");
        setName("");
        setBaseAssetSymbol("");
        setQuoteAssetSymbol("");
        setMinQty("");
        setTickSize("");
        setLotSize("");
    }

    async function submit(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        event.stopPropagation();
        setLoading(true);

        const token = getAuthession()?.token;

        if (!token) {
            toast.add({ title: "Request Validation Error", description: "No stored session, please signin as an admin first" });
            setLoading(false);
            return;
        }

        if (action === "ADD") {
            const validateRequest = createMarketSchema.safeParse({ symbol, name, marketType, baseAssetSymbol, quoteAssetSymbol, maxLeverage: Number(maxLeverage), minNotional: Number(minNotional), minQty, tickSize, lotSize });
            if (!validateRequest.success) {
                toast.add({ title: "Request Validation Error", description: validateRequest.error.message });
                setLoading(false);
                return;
            }
        } else {
            const validateRequest = updateMarketSchema.safeParse({ name: name || undefined, minQty: minQty || undefined, tickSize: tickSize || undefined, lotSize: lotSize || undefined });
            if (!validateRequest.success) {
                toast.add({ title: "Request Validation Error", description: validateRequest.error.message });
                setLoading(false);
                return;
            }
        }

        append({
            requestType: "REQ",
            requestMethod: action === "ADD" ? "POST" : "PUT",
            endpoint: action === "ADD" ? "/api/v1/market" : `/api/v1/market/${symbol}`,
            message: `Sending ${action === "ADD" ? "create" : "update"} market request`,
        });

        try {
            const res = action === "ADD"
                ? await createMarket({ token, adminKey, symbol, name, marketType, baseAssetSymbol, quoteAssetSymbol, maxLeverage: Number(maxLeverage), minNotional: Number(minNotional), minQty, tickSize, lotSize })
                : await updateMarket({ token, adminKey, symbol, name: name || undefined, minQty: minQty || undefined, tickSize: tickSize || undefined, lotSize: lotSize || undefined });

            append(res);
            toast.add({
                title: res.success === false ? "Backend Response Error" : "Backend Response",
                description: res.message,
            })

            if (res.success) onDone();

        } catch {

            append({
                requestType: "REQ",
                requestMethod: action === "ADD" ? "POST" : "PUT",
                endpoint: "/api/v1/market",
                message: `Something went wrong`,
            });

        } finally {
            resetForm();
            setLoading(false);
        }
    }

    return (
        <form onSubmit={submit} className="grid grid-cols-1 gap-2 p-3 text-[12px] md:grid-cols-2">
            <div className="flex gap-1 md:col-span-2">
                {(["ADD", "UPDATE"] as const).map((candidate) => (
                    <button
                        key={candidate}
                        type="button"
                        onClick={() => setAction(candidate)}
                        className={`flex-1 border px-2 py-1 ${action === candidate
                            ? candidate === "ADD" ? "border-term-green text-term-green" : "border-term-yellow text-term-yellow"
                            : "border-border text-term-dim"}`}
                    >
                        {candidate}
                    </button>
                ))}
            </div>

            <label>
                <div className="text-term-dim">symbol</div>
                {action === "UPDATE" ? (
                    <select className={inputClass} value={symbol} onChange={(e) => setSymbol(e.target.value)}>
                        <option value="">-- select --</option>
                        {markets.map((market) => <option key={market.id} value={market.symbol}>{market.symbol}</option>)}
                    </select>
                ) : (
                    <input className={inputClass} value={symbol} onChange={(e) => setSymbol(e.target.value)} />
                )}
            </label>

            <label>
                <div className="text-term-dim">name</div>
                <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
            </label>

            {action === "ADD" &&
                <>
                    <label>
                        <div className="text-term-dim">market type</div>
                        <select className={inputClass} value={marketType} onChange={(e) => setMarketType(e.target.value as "SPOT" | "PERP")}>
                            <option value="SPOT">SPOT</option>
                            <option value="PERP">PERP</option>
                        </select>
                    </label>

                    <label>
                        <div className="text-term-dim">max leverage</div>
                        <input className={inputClass} type="number" value={maxLeverage} onChange={(e) => setMaxLeverage(e.target.value)} />
                    </label>

                    <label>
                        <div className="text-term-dim">base symbol</div>
                        <select className={inputClass} value={baseAssetSymbol} onChange={(e) => setBaseAssetSymbol(e.target.value)}>
                            <option value="">-- select --</option>
                            {baseAssets.map((asset) => <option key={asset.id} value={asset.symbol}>{asset.symbol}</option>)}
                        </select>
                    </label>

                    <label>
                        <div className="text-term-dim">quote symbol</div>
                        <select className={inputClass} value={quoteAssetSymbol} onChange={(e) => setQuoteAssetSymbol(e.target.value)}>
                            <option value="">-- select --</option>
                            {quoteAssets.map((asset) => <option key={asset.id} value={asset.symbol}>{asset.symbol}</option>)}
                        </select>
                    </label>

                    <label>
                        <div className="text-term-dim">min notional</div>
                        <input className={inputClass} type="number" value={minNotional} onChange={(e) => setMinNotional(e.target.value)} />
                    </label>
                </>
            }

            <label>
                <div className="text-term-dim">min qty</div>
                <input className={inputClass} value={minQty} onChange={(e) => setMinQty(e.target.value)} />
            </label>

            <label>
                <div className="text-term-dim">tick size</div>
                <input className={inputClass} value={tickSize} onChange={(e) => setTickSize(e.target.value)} />
            </label>

            <label>
                <div className="text-term-dim">lot size</div>
                <input className={inputClass} value={lotSize} onChange={(e) => setLotSize(e.target.value)} />
            </label>

            <div className="flex items-center justify-between gap-2 md:col-span-2">
                <span className="text-term-dim">
                    {action === "ADD" ? "POST /api/v1/market" : `PUT /api/v1/market/${symbol || ":symbol"}`}
                </span>
                <button disabled={loading} className={`border px-3 py-1 disabled:opacity-50 ${action === "ADD" ? "border-term-green text-term-green" : "border-term-yellow text-term-yellow"}`}>
                    {loading ? "applying..." : `$ ./${action.toLowerCase()} --market=${symbol || "?"}`}
                </button>
            </div>
        </form>
    )
}

const inputClass = "w-full border border-border bg-input px-2 py-1 font-mono text-foreground outline-none focus:border-term-green";
