-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "eventSequenceId" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Balance" ADD COLUMN     "eventSequenceId" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "BalanceTransaction" ADD COLUMN     "eventSequenceId" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Fund" ADD COLUMN     "eventSequenceId" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Market" ADD COLUMN     "eventSequenceId" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "eventSequenceId" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "eventSequenceId" INTEGER NOT NULL DEFAULT 0;
