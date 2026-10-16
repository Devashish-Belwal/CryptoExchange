import dotenv from "dotenv";
import { DatabaseError } from "./errors";
dotenv.config();

if (!process.env.DATABASE_URL) {
    throw new DatabaseError("Database URL not found");
}

if (!process.env.JWT_ACCESS_SECRET) {
    throw new DatabaseError("JWT ACCESS SECRECT not found");
}

if (!process.env.JWT_REFRESH_SECRET) {
    throw new DatabaseError("JWT REFRESH SECRET not found");
}

if (!process.env.FRONTEND_URL) {
    throw new DatabaseError("FRONTEND URL not found");
}

if (!process.env.JWT_PASSWORD_REFRESH_SECRET) {
    throw new DatabaseError("JWT PASSWORD REFRESH SECRET not found");
}

if (!process.env.JWT_OTP_SECRET) {
    throw new DatabaseError("JWT OTP SECRET SECRET not found");
}

if (!process.env.ADMIN_KEY) {
    throw new DatabaseError("ADMIN KEY not found");
}

if (!process.env.RESEND_API_KEY) {
    throw new DatabaseError("RESEND API KEY not found");
}

if (!process.env.MAIL_FROM) {
    throw new DatabaseError("MAIL FROM not found");
}


const envConfig = {
    PORT: process.env.PORT ? Number(process.env.PORT) : 8080,
    BCRYPT_SALT_ROUNDS: process.env.BCRYPT_SALT_ROUNDS ? Number(process.env.BCRYPT_SALT_ROUNDS) : 10,
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
    JWT_PASSWORD_REFRESH_SECRET: process.env.JWT_PASSWORD_REFRESH_SECRET,
    JWT_OTP_SECRET: process.env.JWT_OTP_SECRET,
    FRONTEND_URL: process.env.FRONTEND_URL,
    PRIMARY_FRONTEND_URL: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(",")[0].trim() : "",
    ADMIN_KEY: process.env.ADMIN_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    MAIL_FROM: process.env.MAIL_FROM,
}

export default envConfig;