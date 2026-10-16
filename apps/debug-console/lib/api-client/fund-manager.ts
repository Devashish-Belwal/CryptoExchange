"use server";

import { ClientConfig } from "@/utils/config/client";
import { BackendResponseType } from "@/utils/types";
import axios from "axios";


export const getAllFunds = async (
    { token, adminKey }:
        { token: string, adminKey: string }
): Promise<BackendResponseType> => {
    const startAt = Date.now();
    const href = `${ClientConfig.CORE_BACKEND_URL}/funds`;
    const config = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token,
            'x-admin-key': adminKey
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
            endpoint: "/api/v1/funds",
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

export const getFundsBySymbol = async (
    { token, adminKey, symbol }:
        { token: string, adminKey: string, symbol: string }
): Promise<BackendResponseType> => {
    const startAt = Date.now();
    const href = `${ClientConfig.CORE_BACKEND_URL}/funds/${symbol}`;
    const config = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token,
            'x-admin-key': adminKey
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
            endpoint: `/api/v1/funds/${symbol}`,
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
