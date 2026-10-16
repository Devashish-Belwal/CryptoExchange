"use client"

import { Button } from "@workspace/ui/components/button";
import { Panel } from "./Shell";
import { useEffect, useState } from "react";
import { AddUpdateAsset } from "../forms/asset-update";
import { useTerminal } from "@/lib/terminal-client.ts/terminal-store";
import { deleteAsset, getAllAssets } from "@/lib/api-client/asset-manager";
import { toast } from "@workspace/ui/components/toast";
import { getAuthession } from "@/lib/auth-client";
import { ResponsePanel } from "./response-panel";
import { ResponseEntry } from "@/lib/response-client.ts/response-viewer";

type Asset = {
    id: string;
    symbol: string;
    name: string;
    type: string;
    precision: number;
};

export function AssetPanel() {
    const { append } = useTerminal();
    const [assets, setAssets] = useState<Asset[]>([]);
    const [adminKey, setAdminKey] = useState("");
    const [loading, setLoading] = useState(false);

    async function refreshCatalog() {
        setLoading(true);

        append({
            requestType: "REQ",
            requestMethod: "GET",
            endpoint: "/api/v1/asset",
            message: `Fetching asset catalog`,
        });

        try {
            const res = await getAllAssets();
            append(res);

            if (res.success) {
                setAssets(((res.data as { assets?: Asset[] })?.assets) ?? []);
            }
        } catch {
            append({
                requestType: "REQ",
                requestMethod: "GET",
                endpoint: "/api/v1/asset",
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



                {/* Asset list */}
                <Panel
                    className="flex-1"
                    title="asset.catalog"
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
                    <AssetCatalogTab assets={assets} />
                </Panel>

                {/* Create - update asset */}
                <Panel title="asset.mutate · create / update">
                    <AddUpdateAsset adminKey={adminKey} onDone={refreshCatalog} />
                </Panel>

                {/* Delete asset */}
                <Panel title="asset.delete">
                    <AssetDeleteTab assets={assets} adminKey={adminKey} onDone={refreshCatalog} />
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

                <ResponsePanel data={history} title={`asset.request_history · ${history.length} calls`} />
            </div>


        </>
    )
}

function AssetDeleteTab(
    { assets, adminKey, onDone }:
        { assets: Asset[], adminKey: string, onDone: () => void }
) {
    const { append } = useTerminal();
    const [symbol, setSymbol] = useState("");
    const [loading, setLoading] = useState(false);

    async function submit() {
        if (!symbol) {
            toast.add({ title: "Request Validation Error", description: "Select an asset to delete" });
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
            endpoint: `/api/v1/asset/${symbol}`,
            message: `Sending delete asset request`,
        });

        try {
            const res = await deleteAsset({ token, adminKey, symbol });
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
                endpoint: `/api/v1/asset/${symbol}`,
                message: `Something went wrong`,
            });
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="grid gap-3 p-3 text-[12px] md:grid-cols-[1fr_auto]">
            <div>
                <div className="text-term-dim">selected_asset</div>
                <select
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    className="w-full border border-border bg-input px-2 py-1 font-mono outline-none focus:border-term-red"
                >
                    <option value="">-- select --</option>
                    {assets.map((asset) => <option key={asset.id} value={asset.symbol}>{asset.symbol}</option>)}
                </select>
            </div>
            <div className="flex items-end gap-2">
                <button
                    type="button"
                    disabled={loading}
                    onClick={() => void submit()}
                    className="border border-term-red px-3 py-1 text-term-red disabled:opacity-50"
                >
                    {loading ? "deleting..." : "DELETE asset"}
                </button>
            </div>
        </div>
    )
}

function AssetCatalogTab({ assets }: { assets: Asset[] }) {
    return (
        <table className="w-full text-[12px]">
            <thead className="sticky top-0 border-b border-border bg-secondary text-left text-[11px] uppercase text-muted-foreground">
                <tr>
                    <th className="px-3 py-1">asset</th>
                    <th className="px-3 py-1">name</th>
                    <th className="px-3 py-1 text-right">type</th>
                    <th className="px-3 py-1 text-right">precision</th>
                </tr>
            </thead>
            <tbody>{assets.length === 0 ? (
                <tr><td colSpan={4} className="px-3 py-3 text-term-dim">{"// waiting for GET /api/v1/asset"}</td></tr>
            ) : assets.map((asset) => (
                <tr key={asset.id} className="border-b border-border hover:bg-accent/40">
                    <td className="px-3 py-1 text-term-cyan">{asset.symbol}</td>
                    <td className="px-3 py-1 text-term-dim">{asset.name}</td>
                    <td className="px-3 py-1 text-right">{asset.type}</td>
                    <td className="px-3 py-1 text-right text-term-dim">{asset.precision}</td>
                </tr>
            ))}</tbody>
        </table>
    )
}
