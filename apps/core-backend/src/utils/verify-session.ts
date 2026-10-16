import jwt from "jsonwebtoken";
import envConfig from "./config.js";
import { AuthenticationError } from "./errors.js";

// ACCESS/REFRESH tokens are tied to a login session and always carry a sessionId.
// PASSWORD/OTP tokens are single-purpose (signed with only a userId) and are never
// attached to a session, so the two overloads below give callers the correct shape
// for each kind instead of forcing every caller to deal with an optional sessionId.
export function verifyJWTToken(jwtToken: string, type: "ACCESS" | "REFRESH"): { userId: string, sessionId: string };
export function verifyJWTToken(jwtToken: string, type: "PASSWORD" | "OTP"): { userId: string };
export function verifyJWTToken(jwtToken: string, type: "ACCESS" | "REFRESH" | "PASSWORD" | "OTP"): { userId: string, sessionId?: string } {
    try {
        let secret = "";
        switch (type) {
            case "ACCESS":
                secret = envConfig.JWT_ACCESS_SECRET
                break;
            case "REFRESH":
                secret = envConfig.JWT_REFRESH_SECRET
                break;
            case "PASSWORD":
                secret = envConfig.JWT_PASSWORD_REFRESH_SECRET
                break;
            case "OTP":
                secret = envConfig.JWT_OTP_SECRET
                break;
            default:
                break;
        }

        const decoded = jwt.verify(jwtToken, secret);

        if (typeof decoded !== "object" || decoded === null || !("userId" in decoded)) {
            throw new AuthenticationError("JWT is not valid");
        }

        if ((type === "ACCESS" || type === "REFRESH") && !("sessionId" in decoded)) {
            throw new AuthenticationError("JWT is not valid");
        }

        return decoded as { userId: string, sessionId: string };
    } catch (err) {
        if (err instanceof Error && err.name === "TokenExpiredError") throw new AuthenticationError("JWT is expired");

        throw new AuthenticationError("JWT is not valid");
    }
}