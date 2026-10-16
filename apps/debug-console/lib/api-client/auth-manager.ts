"use server";

import { ClientConfig } from "@/utils/config/client";
import { BackendResponseType } from "@/utils/types";
import axios from "axios";


export const registerUser = async (
    { email, username, password, confirmPassword, adminKey }:
        { email: string, username: string, password: string, confirmPassword: string, adminKey: string }
): Promise<BackendResponseType> => {
    const startAt = Date.now();
    const href = `${ClientConfig.CORE_BACKEND_URL}/auth/signup`;
    const payload = { email, username, password, confirmPassword };
    const config = {
        headers: {
            'Content-Type': 'application/json',
            'x-admin-key': adminKey
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
            endpoint: "/api/v1/auth/signup",
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

export const verifyOTP = async (
    { token, otp }:
        { token: string, otp: string }
): Promise<BackendResponseType> => {
    const startAt = Date.now();
    const href = `${ClientConfig.CORE_BACKEND_URL}/auth/verify-otp`;
    const payload = { token, otp };
    const config = {
        headers: {
            'Content-Type': 'application/json',
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
            endpoint: "/api/v1/auth/verify-otp",
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

export const resetPassword = async (
    { token, password, confirmPassword }:
        { token: string, password: string, confirmPassword: string }
): Promise<BackendResponseType> => {
    const startAt = Date.now();
    const href = `${ClientConfig.CORE_BACKEND_URL}/auth/reset-password`;
    const payload = { token, password, confirmPassword };
    const config = {
        headers: {
            'Content-Type': 'application/json',
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
            endpoint: "/api/v1/auth/reset-password",
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

export const changePassword = async (
    { token, oldPassword, password, confirmPassword }:
        { token: string, oldPassword: string, password: string, confirmPassword: string }
): Promise<BackendResponseType> => {
    const startAt = Date.now();
    const href = `${ClientConfig.CORE_BACKEND_URL}/auth/change-password`;
    const payload = { oldPassword, password, confirmPassword };
    const config = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token
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
            endpoint: "/api/v1/auth/change-password",
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

export const loginUser = async (
    { username, password }:
        { username: string, password: string }
): Promise<BackendResponseType> => {
    const startAt = Date.now();
    const href = `${ClientConfig.CORE_BACKEND_URL}/auth/signin`;
    const payload = { username, password };
    const config = {
        headers: {
            'Content-Type': 'application/json',
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
            endpoint: "/api/v1/auth/signin",
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