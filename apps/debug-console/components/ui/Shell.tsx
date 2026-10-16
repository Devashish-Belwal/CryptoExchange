"use client"
import { ClientConfig } from "@/utils/config/client";
import { ReactNode } from "react";
import { ShellNavigator, Timer, UserBoard } from "./Shell-components";
import { IST_TIME_ZONE } from "@/lib/time";

export function Shell({ children }: { children: ReactNode }) {
    return (
        <div className="flex h-screen min-h-0 flex-col bg-background text-foreground">

            {/* header */}
            <header className="flex items-center justify-between border-b border-border bg-secondary px-3 py-1 text-[12px]">
                <div className="flex items-center gap-4">
                    <span className="text-term-green">●</span>
                    <span className="font-bold tracking-wider">trd-engine</span>
                </div>

                <ShellNavigator />

                <div className="flex items-center gap-3 text-term-dim">
                    <span>env={ClientConfig.NODE_ENV}</span>
                    <UserBoard />
                    <Timer />
                </div>

            </header>

            {children}

            {/* footer */}
            <footer className="flex items-center justify-between border-t border-border bg-secondary px-3 py-1 text-[11px] text-term-dim">
                <div className="flex gap-4">
                    <span>api={ClientConfig.CORE_BACKEND_URL}</span>
                    <span>api={ClientConfig.CORE_WS_URL}</span>
                </div>
                <div className="flex gap-4">
                    <span>market-data.v1 · timezone={IST_TIME_ZONE}</span>
                </div>
            </footer>

        </div>
    )
}

export function Panel({
    title,
    children,
    right,
    className = "",
}: {
    title: string;
    children: ReactNode;
    right?: ReactNode;
    className?: string;
}) {
    return (
        <div className={`flex min-h-0 flex-col border border-border bg-card ${className}`}>
            <div className="flex items-center justify-between border-b border-border bg-secondary px-2 py-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                <span>{title}</span>
                {right}
            </div>
            <div className="min-h-0 flex-1 overflow-auto">{children}</div>
        </div>
    )
}