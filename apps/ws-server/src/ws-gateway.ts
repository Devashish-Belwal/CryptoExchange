import { WebSocketServer, WebSocket, type RawData } from "ws";
import { isMarketChannelKind, type MarketChannelKind } from "./channels";
import { health } from ".";
import http from "node:http";

type SubscribeMessage = {
    op: "subscribe" | "unsubscribe";
    channel: MarketChannelKind;
    symbol: string;
};

type TradeSource = { price: string; qty: string; timestamp: number };

export class WsGateway {
    private wss?: WebSocketServer;

    private readonly clientSubscriptions = new Map<WebSocket, Set<string>>(); // Map from client to channels it is subscribed to
    private readonly channelSubscribers = new Map<string, Set<WebSocket>>(); // Map from channls present to clients subscribed to that channel

    start(server: http.Server, path: string, port: number) {
        this.wss = new WebSocketServer({ server, path }, () => {
            health.websocketServerRunning = true
        });

        this.wss.on("connection", (ws) => this.handleConnection(ws));
        this.wss.on("close", () => health.websocketServerRunning = false);
        this.wss.on("error", (error) => {
            health.websocketServerRunning = false;
            console.log(error);
        });

        console.log(`ws-gateway listening on :${port}`);
    }

    close() {
        for (const ws of this.clientSubscriptions.keys()) {
            ws.close(1001, "server shutting down");
        }

        this.wss?.close();
    }

    publish(kind: MarketChannelKind, symbol: string, data: unknown) {
        const subscribers = this.channelSubscribers.get(`${kind}:${symbol}`);
        if (!subscribers || subscribers.size === 0) return;

        const envelope = JSON.stringify({
            stream: kind,
            symbol,
            data: kind === "trade" ? toTradeUpdate(data as TradeSource) : data,
            ts: Date.now(),
        });

        for (const ws of subscribers) {
            if (ws.readyState === WebSocket.OPEN) ws.send(envelope);
        }
    }

    private handleConnection(ws: WebSocket) {
        this.clientSubscriptions.set(ws, new Set());

        ws.on("message", (raw) => this.handleClientMessage(ws, raw));
        ws.on("close", () => this.handleClose(ws));
        ws.on("error", () => this.handleClose(ws));
    }

    private handleClientMessage(ws: WebSocket, raw: RawData) {
        let message: SubscribeMessage;

        try {
            message = JSON.parse(raw.toString());
        } catch {
            this.send(ws, { error: "invalid_json" });
            return;
        }

        if (message.op !== "subscribe" && message.op !== "unsubscribe") {
            this.send(ws, { error: "invalid_op" });
            return;
        }

        if (!isMarketChannelKind(message.channel) || !message.symbol) {
            this.send(ws, { error: "invalid_channel" });
            return;
        }

        const key = `${message.channel}:${message.symbol}`;

        if (message.op === "subscribe") {
            this.clientSubscriptions.get(ws)?.add(key);

            let subscribers = this.channelSubscribers.get(key);
            if (!subscribers) {
                subscribers = new Set();
                this.channelSubscribers.set(key, subscribers);
            }
            subscribers.add(ws);

            this.send(ws, { op: "subscribed", channel: message.channel, symbol: message.symbol });
        } else {
            this.clientSubscriptions.get(ws)?.delete(key);
            this.channelSubscribers.get(key)?.delete(ws);

            this.send(ws, { op: "unsubscribed", channel: message.channel, symbol: message.symbol });
        }
    }

    private handleClose(ws: WebSocket) {
        const keys = this.clientSubscriptions.get(ws);

        if (keys) {
            for (const key of keys) this.channelSubscribers.get(key)?.delete(ws);
        }

        this.clientSubscriptions.delete(ws);
    }

    private send(ws: WebSocket, payload: unknown) {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
    }
}

function toTradeUpdate(trade: TradeSource) {
    return { price: trade.price, quantity: trade.qty, timestamp: trade.timestamp };
}
