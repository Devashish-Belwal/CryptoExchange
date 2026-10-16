import { Resend } from "resend";
import envConfig from "./config.js";

const resend = new Resend(envConfig.RESEND_API_KEY);

function otpEmailHtml(otp: string, verifyLink: string): string {
    return `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
        <h2 style="margin: 0 0 16px;">Verify your email</h2>
        <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.5;">
            Enter the code below on the verification page to confirm your email address. This code expires in 10 minutes.
        </p>
        <div style="background: #f4f4f5; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
            <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px;">${otp}</span>
        </div>
        <div style="text-align: center; margin-bottom: 24px;">
            <a href="${verifyLink}" style="background: #111827; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-size: 15px; font-weight: 600; display: inline-block;">
                Go to verification page
            </a>
        </div>
        <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #6b7280;">
            If you didn't request this code, you can safely ignore this email.
        </p>
    </div>
    `;
}

function passwordResetEmailHtml(resetLink: string): string {
    return `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
        <h2 style="margin: 0 0 16px;">Reset your password</h2>
        <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.5;">
            We received a request to reset your password. This link expires in 1 hour.
        </p>
        <div style="text-align: center; margin-bottom: 24px;">
            <a href="${resetLink}" style="background: #111827; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-size: 15px; font-weight: 600; display: inline-block;">
                Reset password
            </a>
        </div>
        <p style="margin: 0 0 8px; font-size: 13px; line-height: 1.5; color: #6b7280;">
            If the button above doesn't work, copy and paste this link into your browser:
        </p>
        <p style="margin: 0 0 24px; font-size: 13px; line-height: 1.5; word-break: break-all; color: #2563eb;">
            ${resetLink}
        </p>
        <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #6b7280;">
            If you didn't request a password reset, you can safely ignore this email.
        </p>
    </div>
    `;
}

export async function sendOTPEmail(to: string, otp: string, verifyLink: string): Promise<void> {
    await resend.emails.send({
        from: envConfig.MAIL_FROM,
        to,
        subject: "Your verification code",
        html: otpEmailHtml(otp, verifyLink),
    });
}

export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
    await resend.emails.send({
        from: envConfig.MAIL_FROM,
        to,
        subject: "Reset your password",
        html: passwordResetEmailHtml(resetLink),
    });
}
