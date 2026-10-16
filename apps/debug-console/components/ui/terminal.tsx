"use client";

import { useTerminal } from "@/lib/terminal-client.ts/terminal-store";
import { RequestType, TerminalRequestMethod } from "@/lib/terminal-client.ts/terminal-types";
import { Button } from "@workspace/ui/components/button";

const REQUEST_TYPE_COLOR: Record<RequestType, string> = {
    REQ: "text-blue-400",
    RES: "text-green-400",
    ERROR: "text-red-400",
};

const METHOD_COLOR: Record<TerminalRequestMethod, string> = {
    GET: "text-cyan-400",
    POST: "text-yellow-400",
    PUT: "text-orange-400",
    PATCH: "text-purple-400",
    DELETE: "text-red-400",
    WS: "text-pink-400",
    SYSTEM: "text-gray-400",
    ERROR: "text-red-500",
};

export function Terminal({ title = "debug.console", className = "" }: { title?: string; className?: string }) {
    const { clear, logs } = useTerminal();
    return (
        <div className={`flex h-full min-h-0 flex-col border border-border bg-card ${className}`}>
            <div className="flex items-center justify-between border-b border-border bg-secondary px-2 py-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                <div className="flex items-center gap-2">
                    <span className="inline-block size-2 rounded-full bg-term-green" />
                    <span>{title}</span>
                    <span className="text-term-dim">— {logs.length} lines</span>
                </div>
                <div className="flex gap-3">
                    <Button onClick={clear} className="hover:text-term-yellow">[clear]</Button>
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-auto px-2 py-1 text-[12px] leading-snug">
                {
                    logs.length === 0 ? (
                        <div className="text-term-dim">{`// waiting for events...`}</div>
                    ) : (

                        logs.map((l) => (
                            <div
                                key={l.id}
                                className="flex flex-wrap items-center gap-2 overflow-hidden font-mono"
                            >
                                <span className="text-term-dim">
                                    [{new Date(l.timestamp).toLocaleTimeString()}]
                                </span>

                                <span className={REQUEST_TYPE_COLOR[l.requestType]}>
                                    [{l.requestType}]
                                </span>

                                <span className={METHOD_COLOR[l.requestMethod]}>
                                    {l.requestMethod}
                                </span>

                                {l.endpoint && (
                                    <span
                                        className="min-w-0 shrink truncate text-term-cyan"
                                    >
                                        {l.endpoint}
                                    </span>
                                )}

                                {typeof l.status === "number" && (
                                    <span
                                        className={
                                            l.status >= 200 && l.status < 300
                                                ? "text-green-400"
                                                : l.status >= 400
                                                    ? "text-red-400"
                                                    : "text-yellow-400"
                                        }
                                    >
                                        {l.status}
                                    </span>
                                )}

                                {typeof l.duration === "number" && (
                                    <span className="text-term-dim">
                                        {l.duration}ms
                                    </span>
                                )}

                                <span
                                    className="min-w-0 flex-1 truncate text-foreground"
                                >
                                    {l.message}
                                </span>
                            </div>
                        ))
                    )
                }

            </div>


            <div className="border-t border-border bg-secondary px-2 py-1 text-[11px] text-term-dim">
                <span className="text-term-green">$</span> stream --follow --level=debug
            </div>
        </div>
    )
}