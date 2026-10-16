import { Request, Response, NextFunction } from "express";
import { AuthenticationError, AuthorizationError } from "../utils/errors";
import { verifyJWTToken } from "../utils/verify-session";
import envConfig from "../utils/config";
import { prisma } from "@workspace/database";


export const requireAuth = (request: Request, reponse: Response, next: NextFunction): void => {
    const authHeader = request.headers.authorization;

    if (!authHeader) throw new AuthenticationError("Access Token not available");

    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
        throw new AuthenticationError("Access Token not available");
    }

    const { userId, sessionId } = verifyJWTToken(token, "ACCESS");
    request.userId = userId;
    request.sessionId = sessionId;
    next();
}


export const requireAdminAuth = async (request: Request, reponse: Response, next: NextFunction): Promise<void> => {
    const authHeader = request.headers.authorization;

    if (!authHeader) throw new AuthenticationError("Access Token not available");

    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
        throw new AuthenticationError("Access Token not available");
    }

    const { userId, sessionId } = verifyJWTToken(token, "ACCESS");

    // sent as a separate header, to match the server-configured value
    const adminKey = request.headers["x-admin-key"];

    if (!adminKey || adminKey !== envConfig.ADMIN_KEY) {
        console.log("Admin error");

        throw new AuthorizationError("Admin permission required");
    }

    const user = await prisma.user.findFirst({
        where: { id: userId },
        select: { isAdmin: true }
    })

    if (!user || !user.isAdmin) {
        throw new AuthorizationError("Admin permission required");
    }

    request.userId = userId;
    request.sessionId = sessionId;
    next();
}
