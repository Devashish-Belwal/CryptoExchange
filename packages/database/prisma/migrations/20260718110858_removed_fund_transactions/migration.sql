/*
  Warnings:

  - You are about to drop the `FundTransaction` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "FundTransaction" DROP CONSTRAINT "FundTransaction_fundId_fkey";

-- DropTable
DROP TABLE "FundTransaction";
