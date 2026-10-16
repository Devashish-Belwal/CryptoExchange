"use client";

import { HEALTH_CHECKS, HealthCheckResult } from "@/lib/site-data";
import { useCallback, useEffect, useState } from "react";
import { Panel } from "./Shell";
import { Button } from "@workspace/ui/components/button";
import { getHealthUpdate } from "@/lib/api-client/health-check";
import { useTerminal } from "@/lib/terminal-client.ts/terminal-store";

export function HealthCheckPanel() {
    const { append } = useTerminal();
    const [health, setHealth] = useState<Record<string, HealthCheckResult>>({});
    const [refreshing, setRefreshing] = useState(false);

    const refreshHealth = useCallback(async () => {
        setRefreshing(true);
        setHealth((current) => Object.fromEntries(HEALTH_CHECKS.map((h) => [
            h.name,
            current[h.name] ?? {
                name: h.name,
                status: "checking",
                latency: 0,
                checkedAt: "—",
            }
        ])));

        append({
            requestType: "REQ",
            requestMethod: "GET",
            endpoint: "/health",
            message: `Checking ${HEALTH_CHECKS.length} services`,
        });

        try {
            const results = await getHealthUpdate();

            results.forEach((service) => {
                append({
                    requestType: service.status === "up" ? "RES" : "ERROR",
                    requestMethod: "GET",
                    endpoint: service.endpoint,
                    status: service.httpStatus,
                    duration: service.latency,
                    message:
                        service.status === "up"
                            ? `${service.name} responded successfully`
                            : `${service.name} is unreachable`,
                })
            })

            setHealth((current) => ({
                ...current,
                ...Object.fromEntries(results.map((r) => [
                    r.name,
                    {
                        name: r.name,
                        status: r.status,
                        latency: r.latency,
                        checkedAt: new Date(r.checkedAt).toLocaleTimeString(),
                    },
                ])),
            }));

        } catch {
            append({
                requestType: "ERROR",
                requestMethod: "GET",
                endpoint: "/health",
                message: "Health check request failed",
            });
        } finally {
            setRefreshing(false);
        }
    }, [append]);

    useEffect(() => {
        // Add logger entry
        const initializeTimer = window.setTimeout(() => void refreshHealth(), 0);
        const timer = window.setInterval(() => void refreshHealth(), 60_000);

        return () => {
            window.clearTimeout(initializeTimer);
            window.clearInterval(timer);
        }
    }, [refreshHealth]);


    return (
        <Panel
            title="alive.routes · /api/v1/alive/*"
            right={
                <Button
                    onClick={() => void refreshHealth()}
                    disabled={refreshing}
                    className="hover:text-term-yellow border-0 disabled:opacity-50"
                >
                    {refreshing ? "[checking]" : "[refresh]"}
                </Button>
            }
        >
            <table className="w-full text-[12px]">
                <tbody>
                    {HEALTH_CHECKS.map((m) => {
                        const result = health[m.name];
                        const status = result?.status ?? "checking";

                        return (
                            <tr
                                key={m.name}
                                className="border-b border-border"
                            >
                                <td className="px-3 py-1 text-foreground">
                                    {m.name}
                                </td>
                                <td className="px-3 py-1 text-term-dim">
                                    {m.description}
                                </td>
                                <td
                                    className={`px-3 py-1 ${status === "up" ? "text-term-green" : status === "down" ? "text-term-red" : "text-term-yellow"}`}
                                >
                                    ● {status.toUpperCase()}
                                </td>
                                <td className="px-3 py-1 text-right text-term-dim">
                                    {result?.latency ?? 0}ms · {result?.checkedAt ?? "—"}
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </Panel>
    )

}