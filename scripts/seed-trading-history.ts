import { prisma } from "@workspace/database";
import { Client } from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:8080/api/v1";
const ADMIN_KEY = process.env.ADMIN_KEY || "local_admin_secret_key";

console.log(`\n======================================================`);
console.log(` Starting CEX Trading History & Market Seeder`);
console.log(` Target API: ${API_BASE_URL}`);
console.log(`======================================================\n`);

async function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path: string, options: RequestInit = {}) {
    const url = `${API_BASE_URL}${path}`;
    const headers = {
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
        ...(options.headers || {}),
    };

    const res = await fetch(url, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, data };
}

async function main() {
    // -------------------------------------------------------------------------
    // 1. Create or Verify Test Users
    // -------------------------------------------------------------------------
    console.log(`[1/6] Registering test accounts...`);

    const users = [
        { username: "admin_cex", email: "admin@cex.local", password: "Password123!", isAdmin: true },
        { username: "market_maker", email: "mm@cex.local", password: "Password123!", isAdmin: false },
        { username: "trader_whale", email: "whale@cex.local", password: "Password123!", isAdmin: false },
        { username: "trader_alice", email: "alice@cex.local", password: "Password123!", isAdmin: false },
    ];

    for (const u of users) {
        const signupRes = await request("/auth/signup", {
            method: "POST",
            headers: u.isAdmin ? { "x-admin-key": ADMIN_KEY } : {},
            body: JSON.stringify({ username: u.username, email: u.email, password: u.password }),
        });

        if (signupRes.ok) {
            console.log(`  ✔ Created user: ${u.username}`);
        } else if (signupRes.data?.error?.message?.includes("already exists")) {
            console.log(`  ℹ User already exists: ${u.username}`);
        } else {
            console.warn(`  ⚠ Signup notice for ${u.username}:`, signupRes.data?.error?.message || signupRes.status);
        }
    }

    // Direct DB update to ensure all users are marked as verified and admin flag is accurate
    try {
        console.log(`\n[2/6] Verifying accounts in PostgreSQL...`);
        await prisma.user.updateMany({
            where: { username: { in: users.map((u) => u.username) } },
            data: { isVerified: true },
        });

        await prisma.user.updateMany({
            where: { username: "admin_cex" },
            data: { isAdmin: true },
        });
        console.log(`  ✔ All seed accounts marked isVerified: true`);
    } catch (e: any) {
        console.warn(`  ⚠ Could not verify via direct Prisma connection (continuing via API):`, e.message);
    }

    // -------------------------------------------------------------------------
    // 2. Sign In and Obtain Auth Tokens
    // -------------------------------------------------------------------------
    console.log(`\n[3/6] Authenticating users and obtaining JWT tokens...`);
    const tokens: Record<string, string> = {};

    for (const u of users) {
        const signinRes = await request("/auth/signin", {
            method: "POST",
            body: JSON.stringify({ username: u.username, password: u.password }),
        });

        if (!signinRes.ok || !signinRes.data?.data?.token) {
            throw new Error(`Failed to sign in as ${u.username}: ${JSON.stringify(signinRes.data)}`);
        }

        tokens[u.username] = signinRes.data.data.token;
        console.log(`  ✔ Authenticated as ${u.username}`);
    }

    const adminToken = tokens["admin_cex"];
    const makerToken = tokens["market_maker"];
    const whaleToken = tokens["trader_whale"];
    const aliceToken = tokens["trader_alice"];

    // -------------------------------------------------------------------------
    // 3. Create Assets
    // -------------------------------------------------------------------------
    console.log(`\n[4/6] Creating Asset Catalog (USDC, BTC, ETH, SOL)...`);
    const assets = [
        { symbol: "USDC", name: "USD Coin", type: "QUOTE", precision: 6, logoUrl: "https://cryptologos.cc/logos/usd-coin-usdc-logo.png" },
        { symbol: "BTC", name: "Bitcoin", type: "BASE", precision: 8, logoUrl: "https://cryptologos.cc/logos/bitcoin-btc-logo.png" },
        { symbol: "ETH", name: "Ethereum", type: "BASE", precision: 8, logoUrl: "https://cryptologos.cc/logos/ethereum-eth-logo.png" },
        { symbol: "SOL", name: "Solana", type: "BASE", precision: 8, logoUrl: "https://cryptologos.cc/logos/solana-sol-logo.png" },
    ];

    for (const a of assets) {
        const assetRes = await request("/asset", {
            method: "POST",
            headers: {
                Authorization: adminToken,
                "x-admin-key": ADMIN_KEY,
            },
            body: JSON.stringify(a),
        });

        if (assetRes.ok) {
            console.log(`  ✔ Created asset: ${a.symbol} (${a.name})`);
        } else if (assetRes.data?.error?.message?.includes("already exists")) {
            console.log(`  ℹ Asset already exists: ${a.symbol}`);
        } else {
            console.warn(`  ⚠ Asset notice for ${a.symbol}:`, assetRes.data?.error?.message || assetRes.status);
        }
    }

    // -------------------------------------------------------------------------
    // 4. Create Markets
    // -------------------------------------------------------------------------
    console.log(`\n[5/6] Creating Markets (BTC_USDC, ETH_USDC, SOL_USDC)...`);
    const markets = [
        {
            symbol: "BTC_USDC",
            name: "BTC/USDC",
            marketType: "SPOT",
            baseAssetSymbol: "BTC",
            quoteAssetSymbol: "USDC",
            maxLeverage: 1,
            minNotional: 10,
            minQty: "0.0001",
            tickSize: "0.1",
            lotSize: "0.0001",
            isActive: true,
        },
        {
            symbol: "ETH_USDC",
            name: "ETH/USDC",
            marketType: "SPOT",
            baseAssetSymbol: "ETH",
            quoteAssetSymbol: "USDC",
            maxLeverage: 1,
            minNotional: 10,
            minQty: "0.001",
            tickSize: "0.01",
            lotSize: "0.001",
            isActive: true,
        },
        {
            symbol: "SOL_USDC",
            name: "SOL/USDC",
            marketType: "SPOT",
            baseAssetSymbol: "SOL",
            quoteAssetSymbol: "USDC",
            maxLeverage: 1,
            minNotional: 10,
            minQty: "0.01",
            tickSize: "0.01",
            lotSize: "0.01",
            isActive: true,
        },
    ];

    for (const m of markets) {
        const marketRes = await request("/market", {
            method: "POST",
            headers: {
                Authorization: adminToken,
                "x-admin-key": ADMIN_KEY,
            },
            body: JSON.stringify(m),
        });

        if (marketRes.ok) {
            console.log(`  ✔ Created market: ${m.symbol}`);
        } else if (marketRes.data?.error?.message?.includes("already exist")) {
            console.log(`  ℹ Market already exists: ${m.symbol}`);
        } else {
            console.warn(`  ⚠ Market notice for ${m.symbol}:`, marketRes.data?.error?.message || marketRes.status);
        }
    }

    // -------------------------------------------------------------------------
    // 5. Fund Accounts (On-Ramp)
    // -------------------------------------------------------------------------
    console.log(`\n[6/6] Depositing funds to market makers and traders...`);
    const fundings = [
        { user: "market_maker", token: makerToken, symbol: "USDC", amount: "5000000" },
        { user: "market_maker", token: makerToken, symbol: "BTC", amount: "100" },
        { user: "market_maker", token: makerToken, symbol: "ETH", amount: "1000" },
        { user: "market_maker", token: makerToken, symbol: "SOL", amount: "5000" },

        { user: "trader_whale", token: whaleToken, symbol: "USDC", amount: "2000000" },
        { user: "trader_whale", token: whaleToken, symbol: "BTC", amount: "50" },
        { user: "trader_whale", token: whaleToken, symbol: "ETH", amount: "500" },
        { user: "trader_whale", token: whaleToken, symbol: "SOL", amount: "2500" },

        { user: "trader_alice", token: aliceToken, symbol: "USDC", amount: "500000" },
        { user: "trader_alice", token: aliceToken, symbol: "BTC", amount: "10" },
        { user: "trader_alice", token: aliceToken, symbol: "ETH", amount: "50" },
        { user: "trader_alice", token: aliceToken, symbol: "SOL", amount: "500" },
    ];

    for (const f of fundings) {
        const rampRes = await request("/auth/onramp", {
            method: "POST",
            headers: { Authorization: f.token },
            body: JSON.stringify({ symbol: f.symbol, amount: f.amount }),
        });

        if (rampRes.ok) {
            console.log(`  ✔ Deposited ${f.amount} ${f.symbol} to ${f.user}`);
        } else {
            console.warn(`  ⚠ Deposit notice for ${f.user} ${f.symbol}:`, rampRes.data?.error?.message || rampRes.status);
        }
    }

    // -------------------------------------------------------------------------
    // 6. Execute Trades & Populate Live Order Books
    // -------------------------------------------------------------------------
    console.log(`\n======================================================`);
    console.log(` Simulating Live Trading Activity Across Markets...`);
    console.log(`======================================================\n`);

    async function placeOrder(token: string, order: {
        symbol: string;
        entryPrice: string;
        quantity: string;
        side: "BUY" | "SELL";
        type?: "LIMIT" | "MARKET";
    }) {
        const res = await request("/order", {
            method: "POST",
            headers: { Authorization: token },
            body: JSON.stringify({
                symbol: order.symbol,
                entryPrice: order.entryPrice,
                quantity: order.quantity,
                leverage: 1,
                side: order.side,
                marketType: "SPOT",
                type: order.type || "LIMIT",
                postOnly: false,
                reduceOnly: false,
                stpMode: "CANCEL_MAKER",
                timeInForce: "GTC",
            }),
        });

        return res;
    }

    // --- Market 1: BTC_USDC ---
    console.log(`▶ Generating BTC_USDC order book & trade executions...`);

    // 1. Maker places sell asks
    const btcAsks = [
        { price: "67480.0", qty: "0.8500" },
        { price: "67520.0", qty: "1.2000" },
        { price: "67580.0", qty: "2.1000" },
        { price: "67650.0", qty: "3.5000" },
        { price: "67800.0", qty: "5.0000" },
    ];
    for (const a of btcAsks) {
        await placeOrder(makerToken, { symbol: "BTC_USDC", entryPrice: a.price, quantity: a.qty, side: "SELL" });
    }

    // 2. Maker places buy bids
    const btcBids = [
        { price: "67380.0", qty: "0.9000" },
        { price: "67320.0", qty: "1.5000" },
        { price: "67260.0", qty: "2.4000" },
        { price: "67180.0", qty: "4.0000" },
        { price: "67000.0", qty: "6.5000" },
    ];
    for (const b of btcBids) {
        await placeOrder(makerToken, { symbol: "BTC_USDC", entryPrice: b.price, quantity: b.qty, side: "BUY" });
    }

    // 3. Takers hit the book to create execution history
    const btcTrades = [
        { user: "trader_whale", token: whaleToken, side: "BUY" as const, price: "67480.0", qty: "0.4000" },
        { user: "trader_alice", token: aliceToken, side: "BUY" as const, price: "67480.0", qty: "0.4500" }, // fills ask 1!
        { user: "trader_whale", token: whaleToken, side: "BUY" as const, price: "67520.0", qty: "0.6000" },
        { user: "trader_alice", token: aliceToken, side: "SELL" as const, price: "67380.0", qty: "0.5000" },
        { user: "trader_whale", token: whaleToken, side: "SELL" as const, price: "67380.0", qty: "0.4000" }, // fills bid 1!
        { user: "trader_whale", token: whaleToken, side: "BUY" as const, price: "67520.0", qty: "0.3000" },
    ];

    for (const t of btcTrades) {
        const tradeRes = await placeOrder(t.token, { symbol: "BTC_USDC", entryPrice: t.price, quantity: t.qty, side: t.side });
        if (tradeRes.ok) {
            console.log(`  ⚡ Executed Trade: ${t.side} ${t.qty} BTC @ $${t.price} by ${t.user}`);
        } else {
            console.warn(`  ⚠ Trade skipped:`, tradeRes.data?.error?.message || tradeRes.status);
        }
        await sleep(150);
    }

    // --- Market 2: ETH_USDC ---
    console.log(`\n▶ Generating ETH_USDC order book & trade executions...`);

    const ethAsks = [
        { price: "2642.00", qty: "4.000" },
        { price: "2648.50", qty: "6.500" },
        { price: "2655.00", qty: "10.000" },
        { price: "2665.00", qty: "15.000" },
    ];
    for (const a of ethAsks) {
        await placeOrder(makerToken, { symbol: "ETH_USDC", entryPrice: a.price, quantity: a.qty, side: "SELL" });
    }

    const ethBids = [
        { price: "2638.00", qty: "4.500" },
        { price: "2632.00", qty: "7.000" },
        { price: "2625.00", qty: "12.000" },
        { price: "2615.00", qty: "18.000" },
    ];
    for (const b of ethBids) {
        await placeOrder(makerToken, { symbol: "ETH_USDC", entryPrice: b.price, quantity: b.qty, side: "BUY" });
    }

    const ethTrades = [
        { user: "trader_whale", token: whaleToken, side: "BUY" as const, price: "2642.00", qty: "2.000" },
        { user: "trader_alice", token: aliceToken, side: "BUY" as const, price: "2642.00", qty: "2.000" },
        { user: "trader_whale", token: whaleToken, side: "BUY" as const, price: "2648.50", qty: "3.500" },
        { user: "trader_alice", token: aliceToken, side: "SELL" as const, price: "2638.00", qty: "2.500" },
        { user: "trader_whale", token: whaleToken, side: "SELL" as const, price: "2632.00", qty: "3.000" },
    ];

    for (const t of ethTrades) {
        const tradeRes = await placeOrder(t.token, { symbol: "ETH_USDC", entryPrice: t.price, quantity: t.qty, side: t.side });
        if (tradeRes.ok) {
            console.log(`  ⚡ Executed Trade: ${t.side} ${t.qty} ETH @ $${t.price} by ${t.user}`);
        }
        await sleep(150);
    }

    // --- Market 3: SOL_USDC ---
    console.log(`\n▶ Generating SOL_USDC order book & trade executions...`);

    const solAsks = [
        { price: "155.00", qty: "50.00" },
        { price: "155.60", qty: "85.00" },
        { price: "156.20", qty: "140.00" },
        { price: "157.00", qty: "250.00" },
    ];
    for (const a of solAsks) {
        await placeOrder(makerToken, { symbol: "SOL_USDC", entryPrice: a.price, quantity: a.qty, side: "SELL" });
    }

    const solBids = [
        { price: "154.20", qty: "60.00" },
        { price: "153.60", qty: "100.00" },
        { price: "152.80", qty: "160.00" },
        { price: "151.50", qty: "300.00" },
    ];
    for (const b of solBids) {
        await placeOrder(makerToken, { symbol: "SOL_USDC", entryPrice: b.price, quantity: b.qty, side: "BUY" });
    }

    const solTrades = [
        { user: "trader_whale", token: whaleToken, side: "BUY" as const, price: "155.00", qty: "30.00" },
        { user: "trader_alice", token: aliceToken, side: "BUY" as const, price: "155.00", qty: "20.00" },
        { user: "trader_whale", token: whaleToken, side: "BUY" as const, price: "155.60", qty: "45.00" },
        { user: "trader_alice", token: aliceToken, side: "SELL" as const, price: "154.20", qty: "35.00" },
        { user: "trader_whale", token: whaleToken, side: "SELL" as const, price: "154.20", qty: "25.00" },
    ];

    for (const t of solTrades) {
        const tradeRes = await placeOrder(t.token, { symbol: "SOL_USDC", entryPrice: t.price, quantity: t.qty, side: t.side });
        if (tradeRes.ok) {
            console.log(`  ⚡ Executed Trade: ${t.side} ${t.qty} SOL @ $${t.price} by ${t.user}`);
        }
        await sleep(150);
    }

    // -------------------------------------------------------------------------
    // 7. Refresh TimescaleDB Continuous Aggregates (Candlestick Charts)
    // -------------------------------------------------------------------------
    try {
        console.log(`\nRefreshing TimescaleDB Kline Continuous Aggregates...`);
        const sqlPath = fileURLToPath(new URL("../packages/database/prisma/refresh-continuous-aggregates.sql", import.meta.url));
        const statements = readFileSync(sqlPath, "utf-8")
            .split("\n")
            .filter((line) => line.trim().startsWith("CALL "));

        if (process.env.DATABASE_URL) {
            const client = new Client({ connectionString: process.env.DATABASE_URL });
            await client.connect();
            for (const st of statements) {
                await client.query(st);
            }
            await client.end();
            console.log(`  ✔ Kline aggregates refreshed (1m, 5m, 15m, 1h, 1d candles updated)`);
        }
    } catch (e: any) {
        console.warn(`  ℹ Note on Kline refresh:`, e.message);
    }

    console.log(`\n======================================================`);
    console.log(` 🎉 SEEDING COMPLETED SUCCESSFULLY!`);
    console.log(`   - 4 Assets created (USDC, BTC, ETH, SOL)`);
    console.log(`   - 3 Markets active (BTC_USDC, ETH_USDC, SOL_USDC)`);
    console.log(`   - Order Books populated with bids & asks depth`);
    console.log(`   - Recent Trades logged with realistic price history`);
    console.log(`======================================================\n`);
}

main()
    .catch((err) => {
        console.error("\n❌ Seeding failed:", err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
