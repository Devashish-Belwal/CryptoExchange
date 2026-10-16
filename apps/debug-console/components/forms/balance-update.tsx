"use client"

import { useEffect, useState } from "react";
import { useTerminal } from "@/lib/terminal-client.ts/terminal-store";
import { offRampBalance, onRampBalance } from "@/lib/api-client/wallet-manager";
import { getAllAssets } from "@/lib/api-client/asset-manager";
import { RampUserBalanceSchema } from "@workspace/shared";
import { toast } from "@workspace/ui/components/toast";
import { getAuthession } from "@/lib/auth-client";

export type LedgerEntry = {
    id: string;
    action: "ADD" | "WITHDRAW";
    assetId: string;
    amount: string;
    result: number | string;
    timestamp: string;
};

type Asset = { id: string; symbol: string };

export function AddWithdrawBalance({ onDone }: { onDone: (entry: LedgerEntry) => void }) {
    const { append } = useTerminal();
    const [action, setAction] = useState<"ADD" | "WITHDRAW">("ADD");
    const [loading, setLoading] = useState(false);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [symbol, setSymbol] = useState("");
    const [amount, setAmount] = useState("");

    async function loadAssets() {
        const res = await getAllAssets();
        if (res.success) {
            const list = ((res.data as { assets?: Asset[] })?.assets) ?? [];
            setAssets(list);
            setSymbol((current) => current || list[0]?.symbol || "");
        }
    }

    useEffect(() => {
        const timer = setTimeout(() => loadAssets(), 0);
        return () => clearTimeout(timer);
    }, [])

    function resetForm() {
        setAmount("");
    }

    async function submit(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        event.stopPropagation();
        setLoading(true);

        const validateRequest = RampUserBalanceSchema.safeParse({ symbol, amount });
        if (!validateRequest.success) {
            toast.add({ title: "Request Validation Error", description: validateRequest.error.message });
            setLoading(false);
            return;
        }

        const token = getAuthession()?.token;

        if (!token) {
            toast.add({ title: "Request Validation Error", description: "No stored session, please signin first" });
            setLoading(false);
            return;
        }

        append({
            requestType: "REQ",
            requestMethod: "POST",
            endpoint: action === "ADD" ? "/api/v1/auth/on-ramp" : "/api/v1/auth/off-ramp",
            message: `Sending ${action === "ADD" ? "on-ramp" : "off-ramp"} balance request`,
        });

        try {
            const res = action === "ADD"
                ? await onRampBalance({ token, symbol, amount })
                : await offRampBalance({ token, symbol, amount });

            append(res);
            toast.add({
                title: res.success === false ? "Backend Response Error" : "Backend Response",
                description: res.message,
            })

            if (res.success) {
                const balance = (res.data as { balance?: { symbol: string, total: number, locked: number } })?.balance;
                onDone({
                    id: crypto.randomUUID(),
                    action,
                    assetId: symbol,
                    amount,
                    result: balance?.total ?? "-",
                    timestamp: new Date().toLocaleTimeString(),
                });
            }

        } catch {

            append({
                requestType: "REQ",
                requestMethod: "POST",
                endpoint: action === "ADD" ? "/api/v1/auth/on-ramp" : "/api/v1/auth/off-ramp",
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
                {(["ADD", "WITHDRAW"] as const).map((candidate) => (
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
                <div className="text-term-dim">asset_id</div>
                <select className={inputClass} value={symbol} onChange={(e) => setSymbol(e.target.value)}>
                    <option value="">-- select --</option>
                    {assets.map((asset) => <option key={asset.id} value={asset.symbol}>{asset.symbol}</option>)}
                </select>
            </label>

            <label>
                <div className="text-term-dim">amount</div>
                <input className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>

            <div className="flex items-center justify-between gap-2 md:col-span-2">
                <span className="text-term-dim">
                    POST /api/v1/auth/{action === "ADD" ? "on-ramp" : "off-ramp"}
                </span>
                <button disabled={loading} className={`border px-3 py-1 disabled:opacity-50 ${action === "ADD" ? "border-term-green text-term-green" : "border-term-yellow text-term-yellow"}`}>
                    {loading ? "applying..." : `$ ./${action.toLowerCase()} --asset=${symbol || "?"}`}
                </button>
            </div>
        </form>
    )
}

const inputClass = "w-full border border-border bg-input px-2 py-1 font-mono text-foreground outline-none focus:border-term-green";
