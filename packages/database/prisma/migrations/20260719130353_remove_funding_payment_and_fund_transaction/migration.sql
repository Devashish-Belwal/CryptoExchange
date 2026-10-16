/*
  Warnings:

  - You are about to drop the `FundingPayment` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "FundingPayment" DROP CONSTRAINT "FundingPayment_symbol_fkey";

-- DropForeignKey
ALTER TABLE "FundingPayment" DROP CONSTRAINT "FundingPayment_userId_fkey";

-- DropTable
DROP TABLE "FundingPayment";
