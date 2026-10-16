/*
  Warnings:

  - Added the required column `type` to the `BalanceTransaction` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('TRADE', 'TRANSACTION', 'RELEASE');

-- DropForeignKey
ALTER TABLE "Balance" DROP CONSTRAINT "Balance_symbol_fkey";

-- DropForeignKey
ALTER TABLE "BalanceTransaction" DROP CONSTRAINT "BalanceTransaction_symbol_fkey";

-- AlterTable
ALTER TABLE "BalanceTransaction" ADD COLUMN     "type" "TransactionType" NOT NULL;

-- AddForeignKey
ALTER TABLE "Balance" ADD CONSTRAINT "Balance_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "Asset"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalanceTransaction" ADD CONSTRAINT "BalanceTransaction_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "Asset"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;
