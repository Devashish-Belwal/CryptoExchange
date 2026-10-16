-- schema.prisma has declared `User.isAdmin`, `User.passwordResetTokenHash`,
-- `User.passwordResetTokenExpiry`, `User.singupOTPHash` and `User.singupOTPExpiry`
-- since the initial schema, but no prior migration ever added them - the live dev
-- database was missing all five columns (discovered while building
-- apps/integration-tests: every signup/admin/OTP/password-reset call 500'd with
-- "The column `User.isAdmin` does not exist"). This migration brings migration
-- history in line with what schema.prisma - and every controller that reads these
-- columns - already assumes exists.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isAdmin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordResetTokenHash" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordResetTokenExpiry" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "singupOTPHash" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "singupOTPExpiry" TIMESTAMP(3);
