"use server";

import { v4 as uuidv4 } from "uuid";
import { ClientConfig } from "@/utils/config/client";
import { BackendResponseType } from "@/utils/types";
import axios from "axios";


export const getBalances = async (
    { token }:
        { token: string }
): Promise<BackendResponseType> => {
    const startAt = Date.now();
    const href = `${ClientConfig.CORE_BACKEND_URL}/auth/balances`;
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
            endpoint: "/api/v1/auth/balances",
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

export const onRampBalance = async (
    { token, symbol, amount }:
        { token: string, symbol: string, amount: string }
): Promise<BackendResponseType> => {
    const startAt = Date.now();
    const href = `${ClientConfig.CORE_BACKEND_URL}/auth/on-ramp`;
    const payload = { symbol, amount };
    const config = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token,
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
            endpoint: "/api/v1/auth/on-ramp",
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

export const offRampBalance = async (
    { token, symbol, amount }:
        { token: string, symbol: string, amount: string }
): Promise<BackendResponseType> => {
    const startAt = Date.now();
    const href = `${ClientConfig.CORE_BACKEND_URL}/auth/off-ramp`;
    const payload = { symbol, amount };
    const config = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token,
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
            endpoint: "/api/v1/auth/off-ramp",
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
