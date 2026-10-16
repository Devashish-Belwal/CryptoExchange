"use client"

import { useState } from "react";
import { useTerminal } from "@/lib/terminal-client.ts/terminal-store";
import { createAsset, updateAsset } from "@/lib/api-client/asset-manager";
import { createAssetSchema, updateAssetSchema } from "@workspace/shared";
import { toast } from "@workspace/ui/components/toast";
import { getAuthession } from "@/lib/auth-client";

export function AddUpdateAsset(
    { adminKey, onDone }:
        { adminKey: string, onDone: () => void }
) {
    const { append } = useTerminal();
    const [action, setAction] = useState<"ADD" | "UPDATE">("ADD");
    const [loading, setLoading] = useState(false);
    const [symbol, setSymbol] = useState("");
    const [name, setName] = useState("");
    const [type, setType] = useState<"BASE" | "QUOTE">("BASE");
    const [precision, setPrecision] = useState("");
    const [logoUrl, setLogoUrl] = useState("");

    function resetForm() {
        setSymbol("");
        setName("");
        setPrecision("");
        setLogoUrl("");
    }

    async function submit(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        event.stopPropagation();
        setLoading(true);

        const token = getAuthession()?.token;

        if (!token) {
            toast.add({
                title: "Request Validation Error",
                description: "No stored session, please signin as an admin first",
            })
            setLoading(false);
            return;
        }

        if (action === "ADD") {
            const validateRequest = createAssetSchema.safeParse({ symbol, name, type, precision: Number(precision), logoUrl: logoUrl || undefined });
            if (!validateRequest.success) {
                toast.add({ title: "Request Validation Error", description: validateRequest.error.message });
                setLoading(false);
                return;
            }
        } else {
            const validateRequest = updateAssetSchema.safeParse({ name: name || undefined, precision: precision ? Number(precision) : undefined, logoUrl: logoUrl || undefined });
            if (!validateRequest.success) {
                toast.add({ title: "Request Validation Error", description: validateRequest.error.message });
                setLoading(false);
                return;
            }
        }

        append({
            requestType: "REQ",
            requestMethod: action === "ADD" ? "POST" : "PUT",
            endpoint: action === "ADD" ? "/api/v1/asset" : `/api/v1/asset/${symbol}`,
            message: `Sending ${action === "ADD" ? "create" : "update"} asset request`,
        });

        try {
            const res = action === "ADD"
                ? await createAsset({ token, adminKey, symbol, name, type, precision: Number(precision), logoUrl: logoUrl || undefined })
                : await updateAsset({ token, adminKey, symbol, name: name || undefined, precision: precision ? Number(precision) : undefined, logoUrl: logoUrl || undefined });

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
                endpoint: "/api/v1/asset",
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
                <input className={inputClass} value={symbol} onChange={(e) => setSymbol(e.target.value)} />
            </label>

            <label>
                <div className="text-term-dim">name</div>
                <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
            </label>

            {action === "ADD" &&
                <label>
                    <div className="text-term-dim">type</div>
                    <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as "BASE" | "QUOTE")}>
                        <option value="BASE">BASE</option>
                        <option value="QUOTE">QUOTE</option>
                    </select>
                </label>
            }

            <label>
                <div className="text-term-dim">precision</div>
                <input className={inputClass} type="number" value={precision} onChange={(e) => setPrecision(e.target.value)} />
            </label>

            <label className="col-span-2">
                <div className="text-term-dim">logo url (optional)</div>
                <input className={inputClass} value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
            </label>

            <div className="flex items-center justify-between gap-2 md:col-span-2">
                <span className="text-term-dim">
                    {action === "ADD" ? "POST /api/v1/asset" : `PUT /api/v1/asset/${symbol || ":symbol"}`}
                </span>
                <button disabled={loading} className={`border px-3 py-1 disabled:opacity-50 ${action === "ADD" ? "border-term-green text-term-green" : "border-term-yellow text-term-yellow"}`}>
                    {loading ? "applying..." : `$ ./${action.toLowerCase()} --asset=${symbol || "?"}`}
                </button>
            </div>
        </form>
    )
}

const inputClass = "w-full border border-border bg-input px-2 py-1 font-mono text-foreground outline-none focus:border-term-green";
