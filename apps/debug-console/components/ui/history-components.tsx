"use client"

import { Button } from "@workspace/ui/components/button";
import { Panel } from "./Shell";
import { useEffect, useState } from "react";
import { useTerminal } from "@/lib/terminal-client.ts/terminal-store";
import { getBalanceLedger, getOrdersHistory, getPositionsHistory, getTradesHistory } from "@/lib/api-client/history-manager";
import { getAuthession } from "@/lib/auth-client";
import { toast } from "@workspace/ui/components/toast";
import { BackendResponseType } from "@/utils/types";

function useHistory(
    fetcher: (args: { token: string }) => Promise<BackendResponseType>,
    dataKey: string,
    endpoint: string,
) {
    const { append } = useTerminal();
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    async function refresh() {
        const token = getAuthession()?.token;

        if (!token) {
            toast.add({ title: "Request Validation Error", description: "No stored session, please signin first" });
            return;
        }

        setLoading(true);

        append({
            requestType: "REQ",
            requestMethod: "GET",
            endpoint,
            message: `Fetching ${dataKey} history`,
        });

        try {
            const res = await fetcher({ token });
            append(res);

            if (res.success) {
                setRows(((res.data as Record<string, any[]>)?.[dataKey]) ?? []);
            }
        } catch {
            append({
                requestType: "REQ",
                requestMethod: "GET",
                endpoint,
                message: `Something went wrong`,
            });
        } finally {
            setLoading(false);
        }
    }


    useEffect(() => {
        const timer = setTimeout(() => refresh(), 0);
        return () => clearTimeout(timer);
    }, [])

    return { rows, loading, refresh };
}

function RefreshButton({ loading, onClick }: { loading: boolean, onClick: () => void }) {
    return (
        <Button
            onClick={onClick}
            disabled={loading}
            className="hover:text-term-yellow border-0 disabled:opacity-50"
        >
            {loading ? "[loading]" : "[refresh]"}
        </Button>
    )
}

export function OrderHistoryPanel({ className }: { className?: string }) {
    const { rows, loading, refresh } = useHistory(getOrdersHistory, "orders", "/api/v1/history/orders");

    return (
        <Panel
            title="Order history"
            className={className}
            right={<RefreshButton loading={loading} onClick={() => void refresh()} />}
        >
            <table className="w-full text-[12px]">
                <thead className="border-b border-border bg-secondary text-left text-[11px] uppercase text-muted-foreground">
                    <tr><th className="px-3 py-1">order</th><th className="px-3 py-1">symbol</th><th className="px-3 py-1">side</th><th className="px-3 py-1">type</th><th className="px-3 py-1">status</th><th className="px-3 py-1 text-right">price</th><th className="px-3 py-1 text-right">filled / qty</th></tr>
                </thead>
                <tbody>{rows.length === 0 ? (
                    <tr><td colSpan={7} className="px-3 py-3 text-term-dim">{"// waiting for GET /api/v1/history/orders"}</td></tr>
                ) : rows.map((order) => (
                    <tr key={order.orderId} className="border-b border-border hover:bg-accent/40">
                        <td className="px-3 py-1 text-term-cyan">{order.orderId}</td>
                        <td className="px-3 py-1">{order.symbol}</td>
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

export function PositionHistoryPanel({ className }: { className?: string }) {
    const { rows, loading, refresh } = useHistory(getPositionsHistory, "positions", "/api/v1/history/positions");

    return (
        <Panel title="position history" className={className} right={<RefreshButton loading={loading} onClick={() => void refresh()} />}>
            <table className="w-full text-[12px]">
                <thead className="border-b border-border bg-secondary text-left text-[11px] uppercase text-muted-foreground">
                    <tr><th className="px-3 py-1">position</th><th className="px-3 py-1">symbol</th><th className="px-3 py-1">side</th><th className="px-3 py-1 text-right">lev</th><th className="px-3 py-1 text-right">entry / exit</th><th className="px-3 py-1 text-right">qty</th><th className="px-3 py-1 text-right">realized_pnl</th><th className="px-3 py-1">close</th></tr>
                </thead>
                <tbody>{rows.length === 0 ? (
                    <tr><td colSpan={8} className="px-3 py-3 text-term-dim">{"// waiting for GET /api/v1/history/positions"}</td></tr>
                ) : rows.map((position) => (
                    <tr key={position.positionId} className="border-b border-border hover:bg-accent/40">
                        <td className="px-3 py-1 text-term-cyan">{position.positionId}</td>
                        <td className="px-3 py-1">{position.symbol}</td>
                        <td className={position.side === "LONG" ? "px-3 py-1 text-term-green" : "px-3 py-1 text-term-red"}>{position.side}</td>
                        <td className="px-3 py-1 text-right text-term-dim">{position.leverage}x</td>
                        <td className="px-3 py-1 text-right text-term-dim">{position.entryPrice} / {position.exitPrice}</td>
                        <td className="px-3 py-1 text-right">{position.quantity}</td>
                        <td className={Number(position.realizedPnl) >= 0 ? "px-3 py-1 text-right text-term-green" : "px-3 py-1 text-right text-term-red"}>{position.realizedPnl}</td>
                        <td className="px-3 py-1 text-term-dim">{position.closeReason}</td>
                    </tr>
                ))}</tbody>
            </table>
        </Panel>
    )
}

export function BalanceLedgerPanel({ className }: { className?: string }) {
    const { rows, loading, refresh } = useHistory(getBalanceLedger, "transactions", "/api/v1/history/balances");

    return (
        <Panel title="Balance transaction" className={className} right={<RefreshButton loading={loading} onClick={() => void refresh()} />}>
            <table className="w-full text-[12px]">
                <thead className="border-b border-border bg-secondary text-left text-[11px] uppercase text-muted-foreground">
                    <tr><th className="px-3 py-1">symbol</th><th className="px-3 py-1">side</th><th className="px-3 py-1">type</th><th className="px-3 py-1 text-right">amount</th></tr>
                </thead>
                <tbody>{rows.length === 0 ? (
                    <tr><td colSpan={4} className="px-3 py-3 text-term-dim">{"// waiting for GET /api/v1/history/balances"}</td></tr>
                ) : rows.map((tx) => (
                    <tr key={tx.id} className="border-b border-border hover:bg-accent/40">
                        <td className="px-3 py-1 text-term-cyan">{tx.symbol}</td>
                        <td className={tx.side === "CREDIT" ? "px-3 py-1 text-term-green" : "px-3 py-1 text-term-yellow"}>{tx.side}</td>
                        <td className="px-3 py-1 text-term-dim">{tx.type}</td>
                        <td className="px-3 py-1 text-right">{tx.amount}</td>
                    </tr>
                ))}</tbody>
            </table>
        </Panel>
    )
}

export function TradeHistoryPanel({ className }: { className?: string }) {
    const { rows, loading, refresh } = useHistory(getTradesHistory, "trades", "/api/v1/history/trades");

    return (
        <Panel title="Trade history" className={className} right={<RefreshButton loading={loading} onClick={() => void refresh()} />}>
            <table className="w-full text-[12px]">
                <thead className="border-b border-border bg-secondary text-left text-[11px] uppercase text-muted-foreground">
                    <tr><th className="px-3 py-1">trade</th><th className="px-3 py-1">symbol</th><th className="px-3 py-1">side</th><th className="px-3 py-1 text-right">price</th><th className="px-3 py-1 text-right">qty</th><th className="px-3 py-1 text-right">time</th></tr>
                </thead>
                <tbody>{rows.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-3 text-term-dim">{"// waiting for GET /api/v1/history/trades"}</td></tr>
                ) : rows.map((trade) => (
                    <tr key={trade.id} className="border-b border-border hover:bg-accent/40">
                        <td className="px-3 py-1 text-term-cyan">{trade.tradeId}</td>
                        <td className="px-3 py-1">{trade.symbol}</td>
                        <td className={trade.side === "BUY" ? "px-3 py-1 text-term-green" : "px-3 py-1 text-term-red"}>{trade.side}</td>
                        <td className="px-3 py-1 text-right">{trade.price}</td>
                        <td className="px-3 py-1 text-right">{trade.quantity}</td>
                        <td className="px-3 py-1 text-right text-term-dim">{new Date(trade.createdAt).toLocaleTimeString()}</td>
                    </tr>
                ))}</tbody>
            </table>
        </Panel>
    )
}
