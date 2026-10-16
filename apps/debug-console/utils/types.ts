import { RequestType, TerminalRequestMethod } from "@/lib/terminal-client.ts/terminal-types";

export type BackendResponseType = {
    success: boolean;
    uptime: number;

    requestType: RequestType;
    requestMethod: TerminalRequestMethod;
    endpoint: string;
    status: number;
    duration: number;

    timestamp: string;
    message: string;
    data: unknown;
}