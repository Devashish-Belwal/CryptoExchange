"use server";

import { v4 as uuidv4 } from "uuid";
import { ClientConfig } from "@/utils/config/client";
import { BackendResponseType } from "@/utils/types";
import axios from "axios";


export const getAllMarkets = async (): Promise<BackendResponseType> => {
    const startAt = Date.now();
    const href = `${ClientConfig.CORE_BACKEND_URL}/market`;
    const config = {
        headers: {
            'Content-Type': 'application/json',
        }
    }

    try {

        const res = await axios.get(href, config);
        const responseData = res.data;

        return {
            success: responseData.success,
            uptime: responseData.uptime,
            requestType: "RES",
            requestMethod: "GET",
            endpoint: "/api/v1/market",
            status: res.status,
            duration: Date.now() - startAt,
            timestamp: responseData.timestamp,
            message: responseData.message,
            data: responseData.data,
        } as BackendResponseType;

    } catch (error: any) {
        const responseError = error.response.data

        return {
            success: responseError.success,
            uptime: responseError.uptime,
            requestType: "ERROR",
            requestMethod: "GET",
            endpoint: responseError.path,
            status: responseError.error.statusCode,
            duration: Date.now() - startAt,
            timestamp: responseError.timestamp,
            message: responseError.error.message,
            data: {}
        } as BackendResponseType;
    }
}

export const createMarket = async (
    { token, adminKey, symbol, name, marketType, baseAssetSymbol, quoteAssetSymbol, maxLeverage, minNotional, minQty, tickSize, lotSize }:
        { token: string, adminKey: string, symbol: string, name: string, marketType: "SPOT" | "PERP", baseAssetSymbol: string, quoteAssetSymbol: string, maxLeverage: number, minNotional: number, minQty: string, tickSize: string, lotSize: string }
): Promise<BackendResponseType> => {
    const startAt = Date.now();
    const href = `${ClientConfig.CORE_BACKEND_URL}/market`;
    const payload = { symbol, name, marketType, baseAssetSymbol, quoteAssetSymbol, maxLeverage, minNotional, minQty, tickSize, lotSize };
    const config = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token,
            'x-admin-key': adminKey,
            'Idempotency-Key': uuidv4()
        }
    }

    try {

        const res = await axios.post(href, payload, config);
        const responseData = res.data;

        return {
            success: responseData.success,
            uptime: responseData.uptime,
            requestType: "RES",
            requestMethod: "POST",
            endpoint: "/api/v1/market",
            status: res.status,
            duration: Date.now() - startAt,
            timestamp: responseData.timestamp,
            message: responseData.message,
            data: responseData.data,
        } as BackendResponseType;

    } catch (error: any) {
        const responseError = error.response.data

        return {
            success: responseError.success,
            uptime: responseError.uptime,
            requestType: "ERROR",
            requestMethod: "POST",
            endpoint: responseError.path,
            status: responseError.error.statusCode,
            duration: Date.now() - startAt,
            timestamp: responseError.timestamp,
            message: responseError.error.message,
            data: {}
        } as BackendResponseType;
    }
}

export const updateMarket = async (
    { token, adminKey, symbol, name, minQty, tickSize, lotSize }:
        { token: string, adminKey: string, symbol: string, name?: string, minQty?: string, tickSize?: string, lotSize?: string }
): Promise<BackendResponseType> => {
    const startAt = Date.now();
    const href = `${ClientConfig.CORE_BACKEND_URL}/market/${symbol}`;
    const payload = { name, minQty, tickSize, lotSize };
    const config = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token,
            'x-admin-key': adminKey,
            'Idempotency-Key': uuidv4()
        }
    }

    try {

        const res = await axios.put(href, payload, config);
        const responseData = res.data;

        return {
            success: responseData.success,
            uptime: responseData.uptime,
            requestType: "RES",
            requestMethod: "PUT",
            endpoint: `/api/v1/market/${symbol}`,
            status: res.status,
            duration: Date.now() - startAt,
            timestamp: responseData.timestamp,
            message: responseData.message,
            data: responseData.data,
        } as BackendResponseType;

    } catch (error: any) {
        const responseError = error.response.data

        return {
            success: responseError.success,
            uptime: responseError.uptime,
            requestType: "ERROR",
            requestMethod: "PUT",
            endpoint: responseError.path,
            status: responseError.error.statusCode,
            duration: Date.now() - startAt,
            timestamp: responseError.timestamp,
            message: responseError.error.message,
            data: {}
        } as BackendResponseType;
    }
}

export const deleteMarket = async (
    { token, adminKey, symbol }:
        { token: string, adminKey: string, symbol: string }
): Promise<BackendResponseType> => {
    const startAt = Date.now();
    const href = `${ClientConfig.CORE_BACKEND_URL}/market/${symbol}`;
    const config = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token,
            'x-admin-key': adminKey,
            'Idempotency-Key': uuidv4()
        }
    }

    try {

        const res = await axios.delete(href, config);
        const responseData = res.data;

        return {
            success: responseData.success,
            uptime: responseData.uptime,
            requestType: "RES",
            requestMethod: "DELETE",
            endpoint: `/api/v1/market/${symbol}`,
            status: res.status,
            duration: Date.now() - startAt,
            timestamp: responseData.timestamp,
            message: responseData.message,
            data: responseData.data,
        } as BackendResponseType;

    } catch (error: any) {
        const responseError = error.response.data

        return {
            success: responseError.success,
            uptime: responseError.uptime,
            requestType: "ERROR",
            requestMethod: "DELETE",
            endpoint: responseError.path,
            status: responseError.error.statusCode,
            duration: Date.now() - startAt,
            timestamp: responseError.timestamp,
            message: responseError.error.message,
            data: {}
        } as BackendResponseType;
    }
}
