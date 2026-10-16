export interface ResponseEntry {
    ts: string;
    method: string;
    path: string;
    status: number;
    latency_ms: number;
    request: unknown;
    response: unknown;
}

export function methodColor(method: string) {
    switch (method.toUpperCase()) {
        case "GET":
            return "text-term-cyan";
        case "POST":
            return "text-term-green";
        case "PUT":
        case "PATCH":
            return "text-term-yellow";
        case "DELETE":
            return "text-term-red";
        case "OPTIONS":
            return "text-term-magenta";
        default:
            return "text-term-dim";
    }
}