import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { checkIdempotency, storeIdempotencyResponse } from '../middlewares/idempotency.middleware';

export const asyncHandler = (fn: RequestHandler): RequestHandler => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

export const multiAsyncWrapper = (...handlers: RequestHandler[]): RequestHandler[] => {
    const wrapped = handlers.map(
        (handler: RequestHandler) => (req: Request, res: Response, next: NextFunction) => Promise.resolve(handler(req, res, next)).catch(next)
    )

    return wrapped;
};

export const idempotencyHandler = (handler: RequestHandler, beforeMiddleware?: RequestHandler[], afterMiddleware?: RequestHandler[]): RequestHandler[] => {
    return multiAsyncWrapper(
        ...beforeMiddleware ?? [],
        checkIdempotency,
        handler,
        storeIdempotencyResponse,
        ...afterMiddleware ?? [],
    )
};

