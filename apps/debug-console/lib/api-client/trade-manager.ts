"use server";

import { v4 as uuidv4 } from "uuid";
import { ClientConfig } from "@/utils/config/client";
import { BackendResponseType } from "@/utils/types";
import { TerminalRequestMethod } from "@/lib/terminal-client.ts/terminal-types";
import axios from "axios";

function toSuccess(res: any, requestMethod: TerminalRequestMethod, endpoint: string, startAt: number): BackendResponseType {
    const responseData = res.data;

    return {
        success: responseData.success,
        uptime: responseData.uptime,
        requestType: "RES",
        requestMethod,
        endpoint,
        status: res.status,
        duration: Date.now() - startAt,
        timestamp: responseData.timestamp,
        message: responseData.message,
        data: responseData.data,
    } as BackendResponseType;
}

function toError(error: any, requestMethod: TerminalRequestMethod, startAt: number): BackendResponseType {
    const responseError = error.response.data;

    return {
        success: responseError.success,
        uptime: responseError.uptime,
        requestType: "ERROR",
        requestMethod,
        endpoint: responseError.path,
        status: responseError.error.statusCode,
        duration: Date.now() - startAt,
        timestamp: responseError.timestamp,
        message: responseError.error.message,
        data: {}
    } as BackendResponseType;
}

async function publicGet(path: string, endpoint: string, token?: string): Promise<BackendResponseType> {
    const startAt = Date.now();
    const href = `${ClientConfig.CORE_BACKEND_URL}${path}`;
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': token } : {})
        }
    }

    try {
        const res = await axios.get(href, config);
        return toSuccess(res, "GET", endpoint, startAt);
    } catch (error: any) {
        return toError(error, "GET", startAt);
    }
}


export const getMarketBySymbol = async ({ symbol }: { symbol: string }): Promise<BackendResponseType> =>
    publicGet(`/market/${symbol}`, `/api/v1/market/${symbol}`);

export const getTicker = async ({ symbol }: { symbol: string }): Promise<BackendResponseType> =>
    publicGet(`/tickers/${symbol}`, `/api/v1/tickers/${symbol}`);

export const getDepth = async ({ symbol }: { symbol: string }): Promise<BackendResponseType> =>
    publicGet(`/depth/${symbol}`, `/api/v1/depth/${symbol}`);

export const getMarketTrades = async ({ symbol }: { symbol: string }): Promise<BackendResponseType> =>
    publicGet(`/trades/${symbol}`, `/api/v1/trades/${symbol}`);

export const getKlines = async ({ symbol, interval }: { symbol: string, interval: string }): Promise<BackendResponseType> =>
    publicGet(`/klines/${symbol}?interval=${interval}`, `/api/v1/klines/${symbol}`);

export const getOpenInterest = async ({ symbol }: { symbol: string }): Promise<BackendResponseType> =>
    publicGet(`/openInterest/${symbol}`, `/api/v1/openInterest/${symbol}`);

export const getMarketRisk = async ({ symbol }: { symbol: string }): Promise<BackendResponseType> =>
    publicGet(`/marketRisk/${symbol}`, `/api/v1/marketRisk/${symbol}`);

export const getOpenOrders = async ({ token, symbol }: { token: string, symbol: string }): Promise<BackendResponseType> =>
    publicGet(`/order/${symbol}/all`, `/api/v1/order/${symbol}/all`, token);

export const getOpenPosition = async ({ token, symbol }: { token: string, symbol: string }): Promise<BackendResponseType> =>
    publicGet(`/position/${symbol}`, `/api/v1/position/${symbol}`, token);


export type CreateOrderPayload = {
    symbol: string;
    entryPrice: string;
    quantity: string;
    leverage: number;
    side: string;
    marketType: string;
    type: string;
    postOnly: boolean;
    reduceOnly: boolean;
    stpMode: string;
    timeInForce: string;
};

export const createOrder = async (
    { token, order }:
        { token: string, order: CreateOrderPayload }
): Promise<BackendResponseType> => {
    const startAt = Date.now();
    const href = `${ClientConfig.CORE_BACKEND_URL}/order`;
    const config = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token,
            'Idempotency-Key': uuidv4()
        }
    }

    try {
        const res = await axios.post(href, order, config);
        return toSuccess(res, "POST", "/api/v1/order", startAt);
    } catch (error: any) {
        return toError(error, "POST", startAt);
    }
}

export const cancelAllOrders = async (
    { token, symbol }:
        { token: string, symbol: string }
): Promise<BackendResponseType> => {
    const startAt = Date.now();
    const href = `${ClientConfig.CORE_BACKEND_URL}/order/${symbol}/all`;
    const config = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token,
            'Idempotency-Key': uuidv4()
        }
    }

    try {
        const res = await axios.delete(href, config);
        return toSuccess(res, "DELETE", `/api/v1/order/${symbol}/all`, startAt);
    } catch (error: any) {
        return toError(error, "DELETE", startAt);
    }
}
