import { EVENT_SUBJECT, IndexPriceUpdateEventPayload, latestPricesMapType, MarkPrice } from "@workspace/shared";
import { health } from ".";
import { publish } from "./redis-router";

const BINANCE_STREAM_URL = process.env.BINANCE_MARK_PRICE_STREAM_URL
    ?? "wss://fstream.binance.com/market/ws/!markPrice@arr@1s";

const latestPrice: latestPricesMapType = new Map();

const MARKET_BY_BINANCE_SYMBOL: Record<string, string> = {
    BTCUSDT: "BTC_PERP",
    ETHUSDT: "ETH_PERP",
    SOLUSDT: "SOL_PERP",
};

let activeSocket: WebSocket | undefined;
let stopped = false;

export function connect() {
    const socket = new WebSocket(BINANCE_STREAM_URL);
    activeSocket = socket;

    socket.addEventListener("open", () => {
        health.websocketConnected = true;
        console.log("Binance mark-price websocket connected");
    });

    socket.addEventListener("message", (event) => {
        health.lastMessageAt = Date.now();

        void Promise.resolve()
            .then(() => parseMessage(String(event.data)))
            .then((prices) => Promise.all(prices.map(handlePrice)))
            .catch((error) => console.error("Failed to publish index update", error));
    })

    socket.addEventListener("close", () => {
        health.websocketConnected = false;

        if (stopped) return;

        console.error("Binance mark-price websocket closed; reconnecting");
        setTimeout(connect, 1_000);
    });

    socket.addEventListener("error", (error) => {
        health.websocketConnected = false;
        console.error("Binance mark-price websocket error", error);
        socket.close();
    });
}

export function disconnect() {
    stopped = true;
    activeSocket?.close();
}

function parseMessage(rawMessage: string): MarkPrice[] {
    const message = JSON.parse(rawMessage);

    if (Array.isArray(message)) {
        return message.filter(isFormated);
    }

    if (isFormated(message)) {
        return [message];
    }

    return [];
}

async function handlePrice(price: MarkPrice) {
    const marketSymbol = MARKET_BY_BINANCE_SYMBOL[price.s];

    if (!marketSymbol) {
        return;
    }
    latestPrice.set(marketSymbol, { indexPrice: price.i, markPrice: price.p });

    const payload: IndexPriceUpdateEventPayload = {
        symbol: marketSymbol,
        indexPrice: price.i,
        timestamp: price.E,
    }

    await publish({
        type: EVENT_SUBJECT.INDEX_PRICE_UPDATE_EVENT, payload
    });
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function isFormated(value: unknown): boolean {
    if (!isRecord(value)) {
        return false;
    }

    return typeof value.E === "number"
        && typeof value.s === "string"
        && typeof value.p === "string"
        && typeof value.i === "string";
}
