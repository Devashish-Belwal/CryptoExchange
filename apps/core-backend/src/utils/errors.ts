export class ApiError extends Error {
    statusCode: number;
    type: string;

    constructor(statusCode: number, type: string, message: string) {
        super(message);
        this.statusCode = statusCode;
        this.type = type;

        Object.setPrototypeOf(this, ApiError.prototype);
        Error.captureStackTrace(this, this.constructor);
    }
}

export class AuthenticationError extends ApiError {
    constructor(message: string) {
        super(401, "AuthenticationError", message);
    }
}

export class AuthorizationError extends ApiError {
    constructor(message: string) {
        super(403, "AuthorizationError", message);
    }
}

export class NotFoundError extends ApiError {
    constructor(message: string) {
        super(404, "NotFoundError", message);
    }
}

export class BadRequestError extends ApiError {
    constructor(message: string) {
        super(400, "BadRequestError", message);
    }
}

export class ValidationError extends ApiError {
    constructor(message: string) {
        super(422, "ValidationError", message);
    }
}

export class InternalServerError extends ApiError {
    constructor(message: string) {
        super(500, "InternalServerError", message);
    }
}

export class DatabaseError extends ApiError {
    constructor(message: string) {
        super(500, "DatabaseError", message);
    }
}

export class EngineError extends ApiError {
    constructor(message: string) {
        super(500, "EngineError", message);
    }
}