"use server";
import { v4 as uuidv4 } from "uuid";
import { ClientConfig } from "@/utils/config/client";
import { BackendResponseType } from "@/utils/types";
import axios from "axios";


export const getAllAssets = async (): Promise<BackendResponseType> => {
    const startAt = Date.now();
    const href = `${ClientConfig.CORE_BACKEND_URL}/asset`;
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
            endpoint: "/api/v1/asset",
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

export const createAsset = async (
    { token, adminKey, symbol, name, type, precision, logoUrl }:
        { token: string, adminKey: string, symbol: string, name: string, type: "BASE" | "QUOTE", precision: number, logoUrl?: string }
): Promise<BackendResponseType> => {
    const startAt = Date.now();
    const href = `${ClientConfig.CORE_BACKEND_URL}/asset`;
    const payload = { symbol, name, type, precision, logoUrl };
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

        console.log(responseData);


        return {
            success: responseData.success,
            uptime: responseData.uptime,
            requestType: "RES",
            requestMethod: "POST",
            endpoint: "/api/v1/asset",
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

export const updateAsset = async (
    { token, adminKey, symbol, name, precision, logoUrl }:
        { token: string, adminKey: string, symbol: string, name?: string, precision?: number, logoUrl?: string }
): Promise<BackendResponseType> => {
    const startAt = Date.now();
    const href = `${ClientConfig.CORE_BACKEND_URL}/asset/${symbol}`;
    const payload = { name, precision, logoUrl };
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
            endpoint: `/api/v1/asset/${symbol}`,
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

export const deleteAsset = async (
    { token, adminKey, symbol }:
        { token: string, adminKey: string, symbol: string }
): Promise<BackendResponseType> => {
    const startAt = Date.now();
    const href = `${ClientConfig.CORE_BACKEND_URL}/asset/${symbol}`;
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
            endpoint: `/api/v1/asset/${symbol}`,
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
