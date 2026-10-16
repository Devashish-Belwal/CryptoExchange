-- DropIndex
DROP INDEX "TradeTick_createdAt_idx";

-- AlterTable
ALTER TABLE "TradeTick" ADD CONSTRAINT "TradeTick_pkey" PRIMARY KEY ("id", "createdAt");

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "isVerified" SET DEFAULT false;

-- CreateIndex
CREATE INDEX "TradeTick_createdAt_idx" ON "TradeTick"("createdAt");
