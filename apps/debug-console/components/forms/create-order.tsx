"use client"

import { useState } from "react";
import { useTerminal } from "@/lib/terminal-client.ts/terminal-store";
import { createOrder } from "@/lib/api-client/trade-manager";
import { CreateOrderClientSchema } from "@workspace/shared";
import { toast } from "@workspace/ui/components/toast";
import { getAuthession } from "@/lib/auth-client";

type Market = {
    symbol: string;
    baseAssetId?: string;
    quoteAssetId?: string;
    minOrderSize?: string;
    tickSize?: string;
    lotSize?: string;
    minNotional?: string;
    maxLeverage?: number;
};

const TIF_OPTIONS = [
    { value: "Good_Till_Cancel", label: "GTC" },
    { value: "Immediate_OR_Return", label: "IOC" },
    { value: "Fill_OR_KILL", label: "FOK" },
];

export function CreateOrtder(
    { symbol, market, onDone }:
        { symbol: string, market?: Market, onDone: () => void }
) {
    const { append } = useTerminal();
    const [side, setSide] = useState<"BUY" | "SELL">("BUY");
    const [orderType, setOrderType] = useState<"LIMIT" | "MARKET">("LIMIT");
    const [marketType, setMarketType] = useState<"SPOT" | "PERP">("SPOT");
    const [entryPrice, setEntryPrice] = useState("");
    const [quantity, setQuantity] = useState("");
    const [leverage, setLeverage] = useState("1");
    const [timeInForce, setTimeInForce] = useState("Good_Till_Cancel");
    const [stpMode, setStpMode] = useState("CANCEL_TAKER");
    const [postOnly, setPostOnly] = useState(false);
    const [reduceOnly, setReduceOnly] = useState(false);
    const [busy, setBusy] = useState(false);

    const effectiveTif = orderType === "MARKET" ? "Immediate_OR_Return" : timeInForce;

    async function placeOrder(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        event.stopPropagation();
        setBusy(true);

        const order = {
            symbol,
            entryPrice,
            quantity,
            leverage: marketType === "PERP" ? Number(leverage) : 1,
            side,
            marketType,
            type: orderType,
            postOnly,
            reduceOnly: marketType === "PERP" ? reduceOnly : false,
            stpMode,
            timeInForce: effectiveTif,
        };

        const validateRequest = CreateOrderClientSchema.safeParse(order);
        if (!validateRequest.success) {
            toast.add({ title: "Request Validation Error", description: validateRequest.error.message });
            setBusy(false);
            return;
        }

        const token = getAuthession()?.token;

        if (!token) {
            toast.add({ title: "Request Validation Error", description: "No stored session, please signin first" });
            setBusy(false);
            return;
        }

        append({
            requestType: "REQ",
            requestMethod: "POST",
            endpoint: "/api/v1/order",
            message: `Sending ${side} ${orderType} order for ${symbol}`,
        });

        try {
            const res = await createOrder({ token, order });
            append(res);
            toast.add({
                title: res.success === false ? "Backend Response Error" : "Backend Response",
                description: res.message,
            })

            if (res.success) {
                setQuantity("");
                setEntryPrice("");
                onDone();
            }
        } catch {
            append({
                requestType: "REQ",
                requestMethod: "POST",
                endpoint: "/api/v1/order",
                message: `Something went wrong`,
            });
        } finally {
            setBusy(false);
        }
    }

    return (
        <form onSubmit={placeOrder} className="grid grid-cols-2 gap-2 p-3 text-[12px]">
            <Choice values={["BUY", "SELL"] as const} value={side} onChange={setSide} />
            <Choice values={["LIMIT", "MARKET"] as const} value={orderType} onChange={setOrderType} />
            <Choice values={["SPOT", "PERP"] as const} value={marketType} onChange={setMarketType} />

            <label><span className="text-term-dim">market_id</span><input value={symbol} disabled className={inputCls} /></label>
            <label><span className="text-term-dim">market_type</span><input value={marketType} disabled className={inputCls} /></label>

            <label><span className="text-term-dim">entry_price</span><input value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} disabled={orderType === "MARKET"} className={inputCls} /></label>
            <label><span className="text-term-dim">quantity ({market?.baseAssetId ?? "base"})</span><input value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputCls} /></label>

            <label><span className="text-term-dim">leverage</span><input value={marketType === "PERP" ? leverage : "1"} onChange={(e) => setLeverage(e.target.value)} disabled={marketType !== "PERP"} className={inputCls} /></label>
            <label><span className="text-term-dim">time_in_force</span><select value={effectiveTif} disabled={orderType === "MARKET"} onChange={(e) => setTimeInForce(e.target.value)} className={inputCls}>{TIF_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>

            <label><span className="text-term-dim">stp_mode</span><select value={stpMode} onChange={(e) => setStpMode(e.target.value)} className={inputCls}><option value="CANCEL_TAKER">CANCEL_TAKER</option><option value="CANCEL_MAKER">CANCEL_MAKER</option><option value="CANCEL_BOTH">CANCEL_BOTH</option></select></label>
            <div className="flex items-end gap-3">
                <label className="flex items-center gap-2"><input type="checkbox" checked={postOnly} onChange={(e) => setPostOnly(e.target.checked)} disabled={orderType === "MARKET"} /> post_only</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={reduceOnly} onChange={(e) => setReduceOnly(e.target.checked)} disabled={marketType !== "PERP"} /> reduce_only</label>
            </div>

            <div className="col-span-2 border border-border bg-secondary px-2 py-1 text-term-dim">
                min_qty={market?.minOrderSize ?? "—"} · tick={market?.tickSize ?? "—"} · lot={market?.lotSize ?? "—"} · min_notional={market?.minNotional ?? "—"}
            </div>
            <div className="col-span-2 flex gap-2">
                <button disabled={busy} className={`flex-1 border px-2 py-1 disabled:opacity-50 ${side === "BUY" ? "border-term-green text-term-green" : "border-term-red text-term-red"}`}>{busy ? "submitting..." : `$ ./submit --${side.toLowerCase()}`}</button>
            </div>
        </form>
    )
}

const inputCls = "w-full border border-border bg-input px-2 py-1 font-mono text-foreground outline-none focus:border-term-green disabled:opacity-50";

function Choice<T extends string>(
    { values, value, onChange }:
        { values: readonly T[]; value: T; onChange: (value: T) => void }
) {
    return (
        <div className="col-span-2 flex gap-1">
            {values.map((candidate) =>
                <button
                    key={candidate}
                    type="button"
                    onClick={() => onChange(candidate)}
                    className={`flex-1 border px-2 py-1 ${value === candidate ? "border-term-cyan text-term-cyan" : "border-border text-term-dim"}`}
                >
                    {candidate}
                </button>
            )}
        </div>
    )
}
