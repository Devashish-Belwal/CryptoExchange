"use cleint"

import { AUTH_CHANGED_EVENT, getAuthession } from "@/lib/auth-client";
import { NAV_MODULE } from "@/lib/site-data";
import { formatIstTime, IST_LABEL } from "@/lib/time"
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react"

export function ShellNavigator() {
    const pathname = usePathname();

    return (
        <nav className="flex gap-1">
            {
                NAV_MODULE.map((n) => {
                    const active = pathname === n.to;
                    return (
                        <Link
                            key={n.to}
                            href={n.to}
                            className={`px-2 py-0.5 transition-colors ${active
                                ? "bg-accent text-term-green border border-border"
                                : "text-muted-foreground hover:text-term-green"
                                }`}
                        >
                            {n.label}
                        </Link>
                    )
                })
            }
        </nav>
    )
}

export function Timer() {
    const [now, setNow] = useState("");

    useEffect(() => {
        const tick = () => setNow(formatIstTime());
        tick();
        const i = setInterval(tick, 1000);
        return () => clearInterval(i);
    }, []);

    return (
        <span className="text-term-green">{IST_LABEL} {now}</span>
    )
}


export function UserBoard() {
    const [user, setUser] = useState<{ username: string, isAdmin: boolean } | null>(null);

    useEffect(() => {
        const syncAuth = () => setUser(getAuthession()?.user ?? null);
        syncAuth();

        window.addEventListener(AUTH_CHANGED_EVENT, syncAuth);
        window.addEventListener("storage", syncAuth);

        return () => {
            window.removeEventListener(AUTH_CHANGED_EVENT, syncAuth)
            window.removeEventListener("storage", syncAuth)
        }
    }, []);

    return (
        <>
            <span
                className={user?.username ? "text-term-green" : "text-term-yellow"}
            >
                auth={user?.username ?? "anonymous"}
            </span>
            <span
                className={user?.isAdmin ? "text-term-green" : "text-term-yellow"}
            >
                admin={user?.isAdmin ? "true" : "false"}
            </span>
        </>
    )
}