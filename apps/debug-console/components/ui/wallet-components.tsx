"use client"

import { Button } from "@workspace/ui/components/button";
import { Panel } from "./Shell";
import { AddWithdrawBalance, LedgerEntry } from "../forms/balance-update";
import { useEffect, useState } from "react";
import { useTerminal } from "@/lib/terminal-client.ts/terminal-store";
import { getBalances } from "@/lib/api-client/wallet-manager";
import { getAuthession } from "@/lib/auth-client";
import { toast } from "@workspace/ui/components/toast";

type Balance = { total: number; locked: number };

export function WalletPanels() {
    const { append } = useTerminal();
    const [balances, setBalances] = useState<Record<string, Balance>>({});
    const [ledger, setLedger] = useState<LedgerEntry[]>([]);
    const [loading, setLoading] = useState(false);

    // session-only ledger — records the on-ramp / off-ramp mutations made from
    // this browser tab, cleared on reload.
    function recordMutation(entry: LedgerEntry) {
        setLedger((prev) => [entry, ...prev]);
        void refreshBalances();
    }

    async function refreshBalances() {
        const token = getAuthession()?.token;

        if (!token) {
            toast.add({ title: "Request Validation Error", description: "No stored session, please signin first" });
            return;
        }

        setLoading(true);

        append({
            requestType: "REQ",
            requestMethod: "GET",
            endpoint: "/api/v1/auth/balances",
            message: `Fetching wallet balances`,
        });

        try {
            const res = await getBalances({ token });
            append(res);

            if (res.success) {
                setBalances(((res.data as { balance?: { balances?: Record<string, Balance> } })?.balance?.balances) ?? {});
            }
        } catch {
            append({
                requestType: "REQ",
                requestMethod: "GET",
                endpoint: "/api/v1/auth/balances",
                message: `Something went wrong`,
            });
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        const timer = setTimeout(() => refreshBalances(), 0);
        return () => clearTimeout(timer);
    }, [])

    const rows = Object.entries(balances);
    const availableCount = rows.filter(([, b]) => b.total - b.locked > 0).length;
    const lockedCount = rows.filter(([, b]) => b.locked > 0).length;

    return (
        <div className="flex min-h-0 flex-col gap-px bg-border">

            {/* total balance */}
            <Panel
                title="wallet.balance · engine source of truth"
                className={``}
                right={
                    <Button
                        onClick={() => void refreshBalances()}
                        disabled={loading}
                        className="hover:text-term-yellow border-0 disabled:opacity-50"
                    >
                        {loading ? "[loading]" : "[refresh]"}
                    </Button>
                }
            >
                <div className="grid grid-cols-3 divide-x divide-border text-[12px]">
                    <Stat label="asset_count" value={String(rows.length)} accent="term-green" />
                    <Stat label="available_assets" value={String(availableCount)} accent="foreground" />
                    <Stat label="locked_assets" value={String(lockedCount)} accent="term-yellow" />
                </div>
            </Panel>

            {/* add - withdraw balance */}
            <Panel title="wallet.mutate · real on-ramp / off-ramp"
                right={
                    <Button
                        onClick={() => void refreshBalances()}
                        disabled={loading}
                        className="hover:text-term-yellow border-0 disabled:opacity-50"
                    >
                        {loading ? "[loading]" : "[refresh]"}
                    </Button>
                }>
                <AddWithdrawBalance onDone={recordMutation} />
            </Panel>

            {/* balance map */}
            <Panel title="wallet.assets · total / locked / available" className="flex-1 overflow-y-auto">
                <BalanceTable rows={rows} />
            </Panel>

            {/* balance history */}
            <Panel title="wallet.session_ledger" className="min-h-50">
                <BalanceLedger ledger={ledger} />
            </Panel>

        </div>
    )
}

export function BalanceTable({ rows }: { rows: [string, Balance][] }) {
    return (
        <table className="w-full text-[12px]">
            <thead className="border-b border-border bg-secondary text-left text-[11px] uppercase text-muted-foreground">
                <tr><th className="px-3 py-1">asset</th><th className="px-3 py-1 text-right">total</th><th className="px-3 py-1 text-right">locked</th><th className="px-3 py-1 text-right">available</th></tr>
            </thead>
            <tbody>
                {rows.length === 0 ? (
                    <tr><td colSpan={4} className="px-3 py-3 text-term-dim">{"// no balance data — sign in, then refresh"}</td></tr>
                ) : rows.map(([symbol, balance]) => {
                    const available = Number(balance.total) - Number(balance.locked);
                    return (
                        <tr key={symbol} className="border-b border-border hover:bg-accent/40">
                            <td className="px-3 py-1 text-term-cyan">{symbol}</td>
                            <td className="px-3 py-1 text-right">{balance.total}</td>
                            <td className="px-3 py-1 text-right text-term-yellow">{balance.locked}</td>
                            <td className="px-3 py-1 text-right text-term-green">{available}</td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    )

}

export function BalanceLedger({ ledger }: { ledger: LedgerEntry[] }) {
    return (
        <table className="w-full text-[12px]">
            <tbody>
                {ledger.length === 0 ? (
                    <tr>
                        <td className="px-3 py-2 text-term-dim">{"// balance mutations from this browser session appear here, open history tab to see previous balance history"}
                        </td>
                    </tr>
                ) : ledger.map((row) => (
                    <tr key={row.id} className="border-b border-border">
                        <td className={row.action === "ADD" ? "px-3 py-1 text-term-green" : "px-3 py-1 text-term-yellow"}>{row.action}</td>
                        <td className="px-3 py-1">{row.assetId}</td>
                        <td className="px-3 py-1 text-right">{row.amount}</td>
                        <td className="px-3 py-1 text-right text-term-dim">total={row.result}</td>
                        <td className="px-3 py-1 text-right text-term-dim">{row.timestamp}</td>
                    </tr>
                ))}</tbody>
        </table>
    )
}

function Stat(
    { label, value, accent }:
        { label: string; value: string; accent: "term-green" | "term-yellow" | "foreground" }
) {
    return (
        <div className="p-3">
            <div className="text-[11px] uppercase text-muted-foreground">
                {label}
            </div>
            <div className={`text-xl text-${accent}`}>
                {value}
            </div>
        </div>);
}
