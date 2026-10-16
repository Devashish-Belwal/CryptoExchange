export type IdempotencyRecord =
    | {
        status: "PROCESSING";
        createdAt: string;
    }
    | {
        status: "COMPLETED";
        createdAt: string;
        response: {
            statusCode: number;
            body: unknown;
        };
    };