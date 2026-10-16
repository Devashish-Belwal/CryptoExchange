"use server"

import axios from "axios"
import { HEALTH_CHECKS, HealthCheckResult } from "../site-data"

export const getHealthUpdate = async (): Promise<HealthCheckResult[]> => {
    return Promise.all(
        HEALTH_CHECKS.map(async ({ name, href }): Promise<HealthCheckResult> => {
            const startedAt = Date.now();

            const route = href.split("/")[href.split("/").length - 1]
            const endpoint = `${name}/${route}`

            try {
                const res = await axios.get(href, { timeout: 5_000, validateStatus: () => true });
                const latency = Date.now() - startedAt;
                const checkedAt = new Date().toISOString();

                if (name === "postgres") {
                    const databaseConnected = res.data?.databaseConnected === true;

                    if (databaseConnected) {
                        return { name, endpoint, status: "up", latency, checkedAt, httpStatus: res.status };
                    } else {
                        return { name, endpoint, status: "down", latency, checkedAt, httpStatus: res.status };
                    }
                } else if (name === "redis-stream") {
                    const redisConnected = res.data?.redisConnected === true;

                    if (redisConnected) {
                        return { name, endpoint, status: "up", latency, checkedAt, httpStatus: res.status };
                    } else {
                        return { name, endpoint, status: "down", latency, checkedAt, httpStatus: res.status };
                    }
                } else if (name === "R2 bucket") {
                    const snaphotBucketConnected = res.data?.snaphotBucketConnected === true;

                    if (snaphotBucketConnected) {
                        return { name, endpoint, status: "up", latency, checkedAt, httpStatus: res.status };
                    } else {
                        return { name, endpoint, status: "down", latency, checkedAt, httpStatus: res.status };
                    }
                }
                else {
                    if (res.status >= 200 && res.status < 300) {
                        return {
                            name,
                            endpoint,
                            status: "up",
                            latency,
                            checkedAt,
                            httpStatus: res.status
                        };
                    } else {
                        return { name, endpoint, status: "down", latency, checkedAt };
                    }
                }
            } catch {
                return {
                    name,
                    endpoint,
                    status: "down",
                    latency: Date.now() - startedAt,
                    checkedAt: new Date().toISOString(),
                };
            }
        })
    );
}