import type { Request, Response } from "express";
import { AddUserResponsePayload, ChangePasswordSchema, EVENT_SOURCE, EVENT_SUBJECT, ForgetPasswordSchema, GetUserBalancesResponsePayload, LoginUserSchema, RampUserBalanceSchema, RegisterUserSchema, ResendOTPSchema, resetPasswordZodSchema, verifyOTPZodSchema } from "@workspace/shared";
import { AuthenticationError, EngineError, NotFoundError, ValidationError } from "../utils/errors.js";
import { prisma } from "@workspace/database";
import bcrypt from "bcrypt";
import envConfig from "../utils/config.js";
import { v4 as uuidv4 } from 'uuid';
import jwt from "jsonwebtoken";
import { verifyJWTToken } from "../utils/verify-session.js";
import { RedisRouter } from "../utils/redis-router.js";
import { generateOTP } from "../utils/otp-generator.js";
import { sendOTPEmail, sendPasswordResetEmail } from "../utils/mail-service.js";

export const signup = async (req: Request, res: Response) => {
    const body = req.body;
    const validateData = RegisterUserSchema.safeParse(body);
    if (!validateData.success) throw new ValidationError(validateData.error.issues.map(issue => issue.message).join(", "));

    const { username, email, password } = validateData.data;

    const isUserExist = await prisma.user.findFirst({ where: { OR: [{ username }, { email }] } });

    if (isUserExist) throw new AuthenticationError("User already exists with the provided username or email");

    const passwordHash = await bcrypt.hash(password, envConfig.BCRYPT_SALT_ROUNDS);

    // TODO: Send verification email to the user with a unique token to verify their email address

    const result = await RedisRouter.sendRequestToEngine({
        source: EVENT_SOURCE.BACKEND,
        type: EVENT_SUBJECT.USER_ADD,
        payload: { userId: uuidv4(), username, email, passwordHash }
    });

    if (!result.success) throw new EngineError(result.message);

    if (result.type !== EVENT_SUBJECT.USER_ADD || !result.payload) throw new EngineError(result.message);

    const payload = result.payload as AddUserResponsePayload;

    // Only the exact configured admin key grants isAdmin - any other (including any
    // non-empty but wrong) x-admin-key header must NOT grant it.
    const adminKey = req.headers["x-admin-key"];
    const isAdmin = typeof adminKey === "string" && adminKey === envConfig.ADMIN_KEY;

    // `database-engine` also writes this same row asynchronously off the USER_ADD event
    // this call just published - use upsert (not create) here too so whichever writer
    // lands first never throws a unique-constraint error because of the other.
    await prisma.user.upsert({
        where: { id: payload.userId },
        update: {
            isAdmin,
            ...(isAdmin ? { isVerified: true } : {})
        },
        create: {
            id: payload.userId,
            username: payload.username,
            email: payload.email,
            passwordHash: passwordHash,
            isAdmin,
            isVerified: isAdmin
        }
    })

    return res.status(200).json({
        success: result.success,
        message: "Signup verification OTP send",
        data: { ...payload },
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
}

export const signin = async (req: Request, res: Response) => {
    const dody = req.body;

    const validateData = LoginUserSchema.safeParse(dody);

    if (!validateData.success) throw new ValidationError(validateData.error.issues.map(issue => issue.message).join(", "));

    const { username, password } = validateData.data;

    const user = await prisma.user.findUnique({
        where: { username },
        select: { id: true, username: true, email: true, passwordHash: true, isVerified: true, isArchived: true, isAdmin: true }
    });

    if (!user) throw new AuthenticationError("User not found");

    const { id, email, isVerified, isArchived, isAdmin } = user;

    if (!isVerified) throw new AuthenticationError("User is not verified");

    if (isArchived) throw new AuthenticationError("User is archived");

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) throw new AuthenticationError("Invalid password");

    const sessionId = uuidv4();

    const refreshToken = jwt.sign({ sessionId, userId: id }, envConfig.JWT_REFRESH_SECRET, { expiresIn: "7d" });

    const refreshTokenHash = await bcrypt.hash(refreshToken, envConfig.BCRYPT_SALT_ROUNDS);

    const deviceIP = req.headers["x-forwarded-for"]?.toString() || req.socket.remoteAddress || "";
    const userAgent = req.headers['user-agent'] || "";

    await prisma.session.create({
        data: {
            id: sessionId,
            userId: id,
            refreshTokenHash,
            deviceIP,
            userAgent,
        }
    });

    const accessToken = jwt.sign({ sessionId, userId: id }, envConfig.JWT_ACCESS_SECRET, { expiresIn: "15m" });

    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.status(200).json({
        success: true,
        message: "Signin successful",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        data: { token: `Bearer ${accessToken}`, user: { id, username, email, isAdmin } },
    });
}

export const signout = async (req: Request, res: Response) => {
    const refreshToken = req.cookies.refreshToken as string | undefined;

    if (!refreshToken) throw new AuthenticationError("Refresh token not found");

    const { sessionId } = verifyJWTToken(refreshToken, "REFRESH");

    const session = await prisma.session.findUnique({ where: { id: sessionId } });

    if (!session) throw new AuthenticationError("Session not found");

    await prisma.session.update({
        where: { id: sessionId },
        data: { revoke: true, revokeAt: new Date() }
    });

    res.clearCookie("refreshToken");

    return res.status(200).json({
        success: true,
        message: "Signout successful",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
}

export const refreshToken = async (req: Request, res: Response) => {
    const refreshToken = req.cookies.refreshToken as string | undefined;

    if (!refreshToken) throw new AuthenticationError("Refresh token not found");

    const { userId, sessionId } = verifyJWTToken(refreshToken, "REFRESH");

    const session = await prisma.session.findUnique({ where: { id: sessionId } });

    if (!session) throw new AuthenticationError("Session not found");

    if (session.revoke) throw new AuthenticationError("Session is revoked");

    const isRefreshTokenValid = await bcrypt.compare(refreshToken, session.refreshTokenHash);

    if (!isRefreshTokenValid) throw new AuthenticationError("Refresh token is not valid");

    const newRefreshToken = jwt.sign({ sessionId, userId }, envConfig.JWT_REFRESH_SECRET, { expiresIn: "7d" });

    const newAccessToken = jwt.sign({ sessionId, userId }, envConfig.JWT_ACCESS_SECRET, { expiresIn: "15m" });

    const newRefreshTokenHash = await bcrypt.hash(newRefreshToken, envConfig.BCRYPT_SALT_ROUNDS);

    await prisma.session.update({
        where: { id: sessionId },
        data: { refreshTokenHash: newRefreshTokenHash }
    });

    res.cookie("refreshToken", newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.status(200).json({
        success: true,
        message: "Refresh token successful",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        data: { token: newAccessToken },
    });
}

export const resendOTP = async (req: Request, res: Response) => {
    const body = req.body;

    const validateData = ResendOTPSchema.safeParse(body);

    if (!validateData.success) throw new ValidationError(validateData.error.issues.map(issue => issue.message).join(", "));

    const { email } = validateData.data;

    const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, username: true, email: true, isVerified: true, isArchived: true }
    });

    if (user && !user.isVerified && !user.isArchived) {
        const otp = generateOTP();

        const otpHash = await bcrypt.hash(otp, envConfig.BCRYPT_SALT_ROUNDS);
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // valid for 10 minutes

        await prisma.user.update({
            where: { email },
            data: {
                singupOTPHash: otpHash,
                singupOTPExpiry: otpExpiry
            }
        })

        const otpResetToken = jwt.sign({ userId: user.id }, envConfig.JWT_OTP_SECRET, { expiresIn: "15m" });
        const verifyLink = `${envConfig.PRIMARY_FRONTEND_URL}/signup?token=${otpResetToken}&action=verify-otp`;

        await sendOTPEmail(user.email, otp, verifyLink);
    }

    return res.status(200).json({
        success: true,
        message: "If that account needs verification, a new OTP has been sent",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
}

export const checkOTPVerification = async (req: Request, res: Response) => {
    const body = req.body;

    const validateData = verifyOTPZodSchema.safeParse(body);

    if (!validateData.success) throw new ValidationError(validateData.error.issues.map(issue => issue.message).join(", "));

    const { token, otp } = validateData.data;

    const { userId } = verifyJWTToken(token, "OTP");

    const user = await prisma.user.findUnique({
        where: { id: userId }
    });

    if (!user || !user.singupOTPExpiry || !user.singupOTPHash) throw new AuthenticationError("Invalid or expired token");

    if (user.singupOTPExpiry < new Date()) throw new AuthenticationError("Token has expired");

    const { isArchived } = user;

    if (isArchived) throw new AuthenticationError("User is archived");

    const isOTPValid = await bcrypt.compare(otp, user.singupOTPHash);

    if (!isOTPValid) throw new AuthenticationError("Invalid OTP");

    await prisma.user.update({
        where: { id: user.id },
        data: {
            isVerified: true,
            singupOTPHash: null,
            singupOTPExpiry: null,
        }
    });

    return res.status(200).json({
        success: true,
        message: "User verified successfully",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
}

export const forgetPassword = async (req: Request, res: Response) => {
    const body = req.body;

    const validateData = ForgetPasswordSchema.safeParse(body);

    if (!validateData.success) throw new ValidationError(validateData.error.issues.map(issue => issue.message).join(", "));

    const { email } = validateData.data;

    const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, username: true, email: true, isVerified: true, isArchived: true }
    });

    if (user && user.isVerified && !user.isArchived) {
        const passwordResetToken = jwt.sign({ userId: user.id }, envConfig.JWT_PASSWORD_REFRESH_SECRET, { expiresIn: "1h" });
        const tokenHash = await bcrypt.hash(passwordResetToken, envConfig.BCRYPT_SALT_ROUNDS);
        const tokenExpiry = new Date(Date.now() + 3600000);

        await prisma.user.update({
            where: { email },
            data: {
                passwordResetTokenHash: tokenHash,
                passwordResetTokenExpiry: tokenExpiry
            }
        });

        const resetLink = `${envConfig.PRIMARY_FRONTEND_URL}/signup?token=${passwordResetToken}&action=reset-password`;

        await sendPasswordResetEmail(user.email, resetLink);
    }

    return res.status(200).json({
        success: true,
        message: "If an account with that email exists, a password reset link has been sent",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
}

export const resetPassword = async (req: Request, res: Response) => {
    const body = req.body;

    const validateData = resetPasswordZodSchema.safeParse(body);

    if (!validateData.success) throw new ValidationError(validateData.error.issues.map(issue => issue.message).join(", "));

    const { token, password } = validateData.data;

    const { userId } = verifyJWTToken(token, "PASSWORD");

    const user = await prisma.user.findUnique({
        where: { id: userId }
    });

    if (!user || !user.passwordResetTokenExpiry || !user.passwordResetTokenHash) throw new AuthenticationError("Invalid or expired token");

    if (user.passwordResetTokenExpiry < new Date()) throw new AuthenticationError("Token has expired");

    const { isVerified, isArchived } = user;

    if (!isVerified) throw new AuthenticationError("User is not verified");

    if (isArchived) throw new AuthenticationError("User is archived");

    const isTokenValid = await bcrypt.compare(token, user.passwordResetTokenHash);

    if (!isTokenValid) throw new AuthenticationError("Invalid Token");

    const passwordHash = await bcrypt.hash(password, envConfig.BCRYPT_SALT_ROUNDS);

    await prisma.user.update({
        where: { id: userId },
        data: {
            passwordHash: passwordHash,
            passwordResetTokenHash: null,
            passwordResetTokenExpiry: null
        }
    });

    await prisma.session.updateMany({
        where: { userId, revoke: false },
        data: { revoke: true, revokeAt: new Date() }
    });

    return res.status(200).json({
        success: true,
        message: "Password reset successfully",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
}

export const changePassword = async (req: Request, res: Response) => {
    const userId = req.userId;

    if (!userId) throw new AuthenticationError("User authentication required");

    const refreshToken = req.cookies.refreshToken as string | undefined;

    if (!refreshToken) throw new AuthenticationError("Refresh token not found");

    const { sessionId } = verifyJWTToken(refreshToken, "REFRESH");

    const body = req.body;

    const validateData = ChangePasswordSchema.safeParse(body);

    if (!validateData.success) throw new ValidationError(validateData.error.issues.map(issue => issue.message).join(", "));

    const { password, oldPassword } = validateData.data;

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, email: true, passwordHash: true, isVerified: true, isArchived: true }
    });

    if (!user) throw new AuthenticationError("User not found");

    const { isVerified, isArchived } = user;

    if (!isVerified) throw new AuthenticationError("User is not verified");

    if (isArchived) throw new AuthenticationError("User is archived");

    const isPasswordValid = await bcrypt.compare(oldPassword, user.passwordHash);

    if (!isPasswordValid) throw new AuthenticationError("Invalid password");

    const session = await prisma.session.findUnique({ where: { id: sessionId } });

    if (!session || session.revoke) throw new AuthenticationError("Session not found");

    const newPasswordHash = await bcrypt.hash(password, envConfig.BCRYPT_SALT_ROUNDS);

    await prisma.user.update({
        where: { id: userId },
        data: { passwordHash: newPasswordHash }
    });

    await prisma.session.updateMany({
        where: { userId, revoke: false },
        data: { revoke: true, revokeAt: new Date() }
    });

    res.clearCookie("refreshToken");

    return res.status(200).json({
        success: true,
        message: "Password changed successfully, please login again",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
}

export const getBalances = async (req: Request, res: Response) => {
    const userId = req.userId;

    if (!userId) throw new AuthenticationError("User authentication required");

    const result = await RedisRouter.sendRequestToEngine({
        source: EVENT_SOURCE.BACKEND,
        type: EVENT_SUBJECT.GET_BALANCES,
        payload: { userId }
    });

    if (!result.success) throw new EngineError(result.message);

    if (result.type !== EVENT_SUBJECT.GET_BALANCES || !result.payload) throw new EngineError(result.message);

    const payload = result.payload as GetUserBalancesResponsePayload;

    return res.status(200).json({
        success: result.success,
        message: "Balance Fetched successful",
        data: { balance: payload },
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });

}

export const onRampBalance = async (req: Request, res: Response) => {
    const userId = req.userId;

    if (!userId) throw new AuthenticationError("User authentication required");

    const body = req.body;

    const validateData = RampUserBalanceSchema.safeParse(body);

    if (!validateData.success) throw new ValidationError(validateData.error.issues.map(issue => issue.message).join(", "));

    const { symbol, amount } = validateData.data;

    const result = await RedisRouter.sendRequestToEngine({
        source: EVENT_SOURCE.BACKEND,
        type: EVENT_SUBJECT.ON_RAMP,
        payload: { userId, symbol, amount }
    });

    if (!result.success) throw new EngineError(result.message);

    if (result.type !== EVENT_SUBJECT.ON_RAMP || !result.payload) throw new EngineError(result.message);

    const payload = result.payload;

    return res.status(200).json({
        success: result.success,
        message: "Balance ramped successful",
        data: { balance: payload },
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
}

export const offRampBalance = async (req: Request, res: Response) => {
    const userId = req.userId;

    if (!userId) throw new AuthenticationError("User authentication required");

    const body = req.body;

    const validateData = RampUserBalanceSchema.safeParse(body);

    if (!validateData.success) throw new ValidationError(validateData.error.issues.map(issue => issue.message).join(", "));

    const { symbol, amount } = validateData.data;

    const result = await RedisRouter.sendRequestToEngine({
        source: EVENT_SOURCE.BACKEND,
        type: EVENT_SUBJECT.OFF_RAMP,
        payload: { userId, symbol, amount }
    });

    if (!result.success) throw new EngineError(result.message);

    if (result.type !== EVENT_SUBJECT.OFF_RAMP || !result.payload) throw new EngineError(result.message);

    const payload = result.payload;

    return res.status(200).json({
        success: result.success,
        message: "Balances off ramped successful",
        data: { balance: payload },
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
}

export const getSessions = async (req: Request, res: Response) => {
    const userId = req.userId;

    if (!userId) throw new AuthenticationError("User authentication required");

    const sessions = await prisma.session.findMany({
        where: { userId },
        select: {
            id: true,
            deviceIP: true,
            userAgent: true,
            revoke: true,
            revokeAt: true,
            createdAt: true,
            updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({
        success: true,
        message: "Sessions fetched successful",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        data: {
            sessions: sessions.map((session) => ({ ...session, current: session.id === req.sessionId })),
        },
    });
}

export const revokeSession = async (req: Request, res: Response) => {
    const userId = req.userId;

    if (!userId) throw new AuthenticationError("User authentication required");

    const { sessionId } = req.params;

    if (!sessionId || Array.isArray(sessionId)) {
        throw new ValidationError("Invalid sessionId parameter");
    }

    const session = await prisma.session.findFirst({ where: { id: sessionId, userId } });

    if (!session) throw new NotFoundError("Session not found");

    await prisma.session.update({
        where: { id: sessionId },
        data: { revoke: true, revokeAt: new Date() },
    });

    return res.status(200).json({
        success: true,
        message: "Session revoked successful",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        data: {},
    });
}