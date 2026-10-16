export type TerminalRequestMethod =
    | "GET"
    | "POST"
    | "PUT"
    | "PATCH"
    | "DELETE"
    | "WS"
    | "SYSTEM"
    | "ERROR";

export type RequestType = "REQ" | "RES" | "ERROR"

export type TerminalLog = {
    id: string;
    timestamp: number;
    requestType: RequestType;
    requestMethod: TerminalRequestMethod;
    message: string;
    endpoint?: string;
    status?: number;
    duration?: number;
}

export interface AppendTerminalLog extends Omit<TerminalLog, "id" | "timestamp"> { }
