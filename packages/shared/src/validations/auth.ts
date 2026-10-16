import z from "zod";
import { DecimalStringSchema } from "./order";

export const RegisterUserSchema = z.object({
    username: z.string("Username must be a valid string")
        .trim()
        .min(3, "Username have minimum length of 3"),
    email: z.email("Email must be in proper format"),
    password: z.string("Password must be a valid string")
        .min(8, "Password must be of atleast 8 digits")
        .regex(/[A-Z]/, "Must include uppercase letter")
        .regex(/[0-9]/, "Must include a number"),
    confirmPassword: z.string().min(8),
}).refine(({ password, confirmPassword }) => password === confirmPassword, {
    message: "Password do not match",
    path: ["confirmPassword"]
});

export const LoginUserSchema = z.object({
    username: z.string("Username must be a valid string")
        .trim()
        .min(3, "Username have minimum length of 3"),
    password: z.string("Password must be a valid string")
        .min(8, "Password must be of atleast 8 digits"),
});

export const RampUserBalanceSchema = z.object({
    symbol: z
        .string()
        .trim()
        .min(1, { error: "Market symbol is required" })
        .max(30, { error: "Market symbol cannot exceed 30 characters" })
        .regex(/^[A-Z0-9-]+$/, {
            error: "Market symbol must contain only uppercase letters, numbers or '-'",
        }),
    amount: DecimalStringSchema
})

export const ChangePasswordSchema = z.object({
    oldPassword: z.string().min(8),
    password: z.string("Password must be a valid string")
        .min(8, "Password must be of atleast 8 digits")
        .regex(/[A-Z]/, "Must include uppercase letter")
        .regex(/[0-9]/, "Must include a number"),
    confirmPassword: z.string().min(8),
}).refine(({ password, confirmPassword }) => password === confirmPassword, {
    message: "Password do not match",
    path: ["confirmPassword"]
});

export const ForgetPasswordSchema = z.object({
    email: z.email("Email must be in proper format"),
});

export const resetPasswordZodSchema = z.object({
    token: z.string("Must be a proper token"),
    password: z.string("Password must be a valid string")
        .min(8, "Password must be of atleast 8 digits")
        .regex(/[A-Z]/, "Must include uppercase letter")
        .regex(/[0-9]/, "Must include a number"),
    confirmPassword: z.string().min(8)
}).refine(({ password, confirmPassword }) => password === confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
})

export const ResendOTPSchema = z.object({
    email: z.email("Email must be in proper format"),
});

export const verifyOTPZodSchema = z.object({
    token: z.string({ message: "Must be a proper token" }).trim(),
    otp: z.string("OTP is required").trim().length(6, "OTP must be 6 characters")
})