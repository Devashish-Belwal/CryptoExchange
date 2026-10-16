import { ClientConfig } from "@/utils/config/client";

export const BASE_MODULES = [
    {
        href: "/signup",
        description: "POST /auth/signup",
        name: "auth.signup"
    },
    {
        href: "/signin",
        description: "POST /auth/signin + bearer storage",
        name: "auth.signin"
    },
    {
        href: "/wallet",
        description: "balance, on-ramp, withdrawal",
        name: "wallet.*"
    },
    {
        href: "/asset",
        description: "catalog, create, update asset",
        name: "asset.*"
    },
    {
        href: "/market",
        description: "catalog, ticker, depth, snapshot, ws",
        name: "market.*"
    },
    {
        href: "/order",
        description: "spot, perp, reduce-only, cancel",
        name: "order.*"
    },
    {
        href: "/history",
        description: "orders, positions, funding rate",
        name: "history.*"
    },
    {
        href: "/admin",
        description: "fees, insurance funds",
        name: "admin.*"
    }
]

export const NAV_MODULE = [
    { to: "/", label: "home" },
    { to: "/signup", label: "signup" },
    { to: "/signin", label: "signin" },
    { to: "/wallet", label: "wallet" },
    { to: "/asset", label: "asset" },
    { to: "/market", label: "market" },
    { to: "/trade", label: "trade" },
    { to: "/history", label: "history" },
    { to: "/admin", label: "admin" },
] as const;

export type SERVICES_NAME =
    "core-backend"
    | "market-engine"
    | "ws-engine"
    | "database-engine"
    | "ws-market-poller"
    | "proxy-server"
    | "redis-stream"
    | "postgres"
    | "R2 bucket"
    | "debug-frontend"

export const HEALTH_CHECKS: {
    name: SERVICES_NAME,
    description: string,
    href: string;
}[] = [
    {
        name: "core-backend",
        description: "API process",
        href: `${ClientConfig.BACKEND_URL}/core/api/v1/alive`

    },
    {
        name: "market-engine",
        description: "matching and risk engine",
        href: `${ClientConfig.BACKEND_URL}/engine/alive`
    },
    {
        name: "ws-engine",
        description: "market-data WebSocket",
        href: `${ClientConfig.BACKEND_URL}/ws/alive`

    },
    {
        name: "database-engine",
        description: "database projection worker",
        href: `${ClientConfig.BACKEND_URL}/database/alive`

    },
    {
        name: "ws-market-poller",
        description: "index-price poller",
        href: `${ClientConfig.BACKEND_URL}/poller/alive`

    },
    {
        name: "proxy-server",
        description: "backpack proxy server",
        href: `${ClientConfig.BACKEND_URL}/proxy/alive`

    },
    {
        name: "redis-stream",
        description: "Redis event streams",
        href: `${ClientConfig.BACKEND_URL}/engine/ready`

    },
    {
        name: "postgres",
        description: "PostgreSQL",
        href: `${ClientConfig.BACKEND_URL}/database/ready`

    },
    {
        name: "R2 bucket",
        description: "Snapshot R2 bucket",
        href: `${ClientConfig.BACKEND_URL}/engine/ready`

    },
    {
        name: "debug-frontend",
        description: "this console",
        href: `${ClientConfig.DEBUG_URL}`
    },
] as const;

export type HealthCheckResult = {
    name: SERVICES_NAME;
    endpoint?: string;
    status: "checking" | "up" | "down";
    httpStatus?: number;
    latency: number;
    checkedAt: string;
}