"use server";

import { ClientConfig } from "@/utils/config/client";
import { BackendResponseType } from "@/utils/types";
import axios from "axios";

const request = async (
    { token, path, endpoint }:
        { token: string, path: string, endpoint: string }
): Promise<BackendResponseType> => {
    const startAt = Date.now();
    const href = `${ClientConfig.CORE_BACKEND_URL}${path}`;
    const config = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token
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
            endpoint,
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

export const getTradesHistory = async ({ token }: { token: string }): Promise<BackendResponseType> =>
    request({ token, path: "/history/trades", endpoint: "/api/v1/history/trades" });

export const getOrdersHistory = async ({ token }: { token: string }): Promise<BackendResponseType> =>
    request({ token, path: "/history/orders", endpoint: "/api/v1/history/orders" });

export const getPositionsHistory = async ({ token }: { token: string }): Promise<BackendResponseType> =>
    request({ token, path: "/history/positions", endpoint: "/api/v1/history/positions" });

export const getBalanceLedger = async ({ token }: { token: string }): Promise<BackendResponseType> =>
    request({ token, path: "/history/balances", endpoint: "/api/v1/history/balances" });
